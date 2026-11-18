import { randomBytes } from "node:crypto";
import type { PoolClient } from "pg";
import { db, query } from "@/lib/db";
import { hashToken } from "./session";
import { hashPassword, verifyPassword } from "./password";
import { isValidNickname, normalizeNickname } from "@/domains/profile/nickname";

export type OAuthProvider = "kakao" | "naver";
export type OAuthProfile = {
  provider: OAuthProvider;
  providerUserId: string;
  email?: string;
  emailVerified?: boolean;
  nickname?: string;
  avatarUrl?: string;
  raw: Record<string, unknown>;
};

const CONSENT_VERSION = "2026-11-16";

export async function createOAuthLoginTicket(profile: OAuthProfile, returnTo: string) {
  const verifiedEmail = getVerifiedOAuthEmail(profile);
  const account = await query<{ terms_agreed_at: Date | null; privacy_agreed_at: Date | null }>(
    `SELECT users.terms_agreed_at,users.privacy_agreed_at
     FROM users
     WHERE users.status='active' AND users.deleted_at IS NULL
       AND (
         EXISTS (
           SELECT 1 FROM user_oauth_accounts account
           WHERE account.user_id=users.id AND account.provider=$1 AND account.provider_user_id=$2
         )
         OR (
           $3::text IS NOT NULL
           AND lower(users.email)=lower($3)
           AND users.email_verified_at IS NOT NULL
           AND EXISTS (SELECT 1 FROM user_oauth_accounts social WHERE social.user_id=users.id)
         )
       )
     ORDER BY EXISTS (
       SELECT 1 FROM user_oauth_accounts exact_account
       WHERE exact_account.user_id=users.id
         AND exact_account.provider=$1 AND exact_account.provider_user_id=$2
     ) DESC
     LIMIT 1`,
    [profile.provider, profile.providerUserId, verifiedEmail],
  );
  const current = account.rows[0];
  const requiresAgreement = !current?.terms_agreed_at || !current?.privacy_agreed_at;
  const ticket = randomBytes(32).toString("hex");
  await query(
    `INSERT INTO oauth_login_tickets(
       token_hash,provider,provider_user_id,profile,return_to,requires_agreement,expires_at
     ) VALUES($1,$2,$3,$4::jsonb,$5,$6,now()+interval '10 minutes')`,
    [hashToken(ticket), profile.provider, profile.providerUserId, JSON.stringify(profile), returnTo, requiresAgreement],
  );
  return { ticket, requiresAgreement };
}

export async function getOAuthLoginTicket(ticket: string) {
  const result = await query<{ provider: OAuthProvider; profile: OAuthProfile; return_to: string; requires_agreement: boolean; user_id: string | null }>(
    `SELECT ticket.provider,ticket.profile,ticket.return_to,ticket.requires_agreement,account.user_id
     FROM oauth_login_tickets ticket
     LEFT JOIN user_oauth_accounts account
       ON account.provider=ticket.provider AND account.provider_user_id=ticket.provider_user_id
     WHERE ticket.token_hash=$1 AND ticket.expires_at>now()`,
    [hashToken(ticket)],
  );
  const pending = result.rows[0];
  if (!pending || pending.user_id) return pending || null;

  const verifiedEmail = getVerifiedOAuthEmail(pending.profile);
  if (!verifiedEmail) return pending;
  const existingUser = await query<{ id: string }>(
    `SELECT users.id FROM users
     WHERE lower(users.email)=lower($1)
       AND users.email_verified_at IS NOT NULL
       AND users.status='active' AND users.deleted_at IS NULL
       AND EXISTS (SELECT 1 FROM user_oauth_accounts account WHERE account.user_id=users.id)
     LIMIT 1`,
    [verifiedEmail],
  );
  return { ...pending, user_id: existingUser.rows[0]?.id || null };
}

export async function completeOAuthLoginTicket(
  ticket: string,
  agreements: {
    ageOver14: boolean; terms: boolean; privacy: boolean; nickname: string;
    gender: string; ageRange: string; phoneNumber: string;
  } | null,
  userAgent?: string,
) {
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const pending = await client.query<{
      profile: OAuthProfile; return_to: string; requires_agreement: boolean;
    }>(
      `SELECT profile,return_to,requires_agreement FROM oauth_login_tickets
       WHERE token_hash=$1 AND expires_at>now() FOR UPDATE`,
      [hashToken(ticket)],
    );
    const row = pending.rows[0];
    if (!row) throw new Error("OAUTH_TICKET_INVALID");
    if (row.requires_agreement && (!agreements?.ageOver14 || !agreements.terms || !agreements.privacy)) {
      throw new Error("AGREEMENTS_REQUIRED");
    }
    const requestedNickname = agreements ? normalizeNickname(agreements.nickname) : null;
    if (row.requires_agreement && (!requestedNickname || !isValidNickname(requestedNickname))) {
      throw new Error("NICKNAME_INVALID");
    }

    const profile = row.profile;
    const userId = await upsertOAuthUser(profile, client, agreements, requestedNickname);
    await ensureAcornWallet(userId, client);
    if (agreements) {
      for (const consentKey of ["age_over_14", "service_terms", "privacy_collection"]) {
        await client.query(
          `INSERT INTO user_consents(user_id,consent_key,consent_version,agreed,user_agent)
           VALUES($1,$2,$3,true,$4)
           ON CONFLICT(user_id,consent_key,consent_version)
           DO UPDATE SET agreed=true,user_agent=EXCLUDED.user_agent,agreed_at=now()`,
          [userId, consentKey, CONSENT_VERSION, userAgent || null],
        );
      }
    }
    const sessionToken = await createSession(userId, userAgent, client);
    await client.query("DELETE FROM oauth_login_tickets WHERE token_hash=$1", [hashToken(ticket)]);
    await client.query("COMMIT");
    return { sessionToken, returnTo: row.return_to };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function upsertOAuthUser(
  profile: OAuthProfile,
  client: PoolClient,
  agreements: {
    ageOver14: boolean; terms: boolean; privacy: boolean; nickname: string;
    gender: string; ageRange: string; phoneNumber: string;
  } | null,
  requestedNickname: string | null,
) {
    const verifiedEmail = getVerifiedOAuthEmail(profile);
    if (verifiedEmail) {
      // Prevent two providers completing at the same time from creating two users.
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [verifiedEmail]);
    }
    const account = await client.query<{ user_id: string }>(
      "SELECT user_id FROM user_oauth_accounts WHERE provider=$1 AND provider_user_id=$2 FOR UPDATE",
      [profile.provider, profile.providerUserId],
    );
    let userId = account.rows[0]?.user_id;
    if (!userId && verifiedEmail) {
      const existingUser = await client.query<{ id: string }>(
        `SELECT users.id FROM users
         WHERE lower(users.email)=lower($1)
           AND users.email_verified_at IS NOT NULL
           AND users.status='active' AND users.deleted_at IS NULL
           AND EXISTS (SELECT 1 FROM user_oauth_accounts social WHERE social.user_id=users.id)
         LIMIT 1
         FOR UPDATE`,
        [verifiedEmail],
      );
      userId = existingUser.rows[0]?.id;
    }
    if (requestedNickname) {
      const duplicateNickname = await client.query(
        `SELECT 1 FROM users
         WHERE lower(nickname)=lower($1) AND deleted_at IS NULL
           AND ($2::uuid IS NULL OR id<>$2::uuid)
         LIMIT 1`,
        [requestedNickname, userId || null],
      );
      if (duplicateNickname.rowCount) throw new Error("NICKNAME_TAKEN");
    }
    if (agreements) {
      const duplicatePhone = await client.query(
        `SELECT 1 FROM users
         WHERE phone_number=$1 AND deleted_at IS NULL
           AND ($2::uuid IS NULL OR id<>$2::uuid)
         LIMIT 1`,
        [agreements.phoneNumber, userId || null],
      );
      if (duplicatePhone.rowCount) throw new Error("PHONE_TAKEN");
    }
    const availableEmail = verifiedEmail
      ? await getAvailableOAuthEmail(verifiedEmail, userId, client)
      : null;

    if (!userId) {
      const nickname = requestedNickname || await createAvailableNickname(profile.nickname, client);
      const user = await client.query<{ id: string }>(
        `INSERT INTO users(
           nickname,email,email_verified_at,avatar_url,phone_number,gender,age_range,
           last_login_at,terms_agreed_at,privacy_agreed_at
         ) VALUES($1,$2,CASE WHEN $3 THEN now() END,$4,$5,$6,$7,now(),CASE WHEN $8 THEN now() END,CASE WHEN $8 THEN now() END)
         RETURNING id`,
        [nickname, availableEmail, Boolean(availableEmail && profile.emailVerified), profile.avatarUrl || null,
          agreements?.phoneNumber || null, agreements?.gender || null, agreements?.ageRange || null, Boolean(agreements)],
      );
      userId = user.rows[0].id;
    } else {
      await client.query(
        `UPDATE users SET nickname=COALESCE($2,nickname),avatar_url=COALESCE(avatar_url,$3),
         email_verified_at=CASE WHEN email IS NULL AND $4::varchar IS NOT NULL AND $5 THEN now() ELSE email_verified_at END,
         email=COALESCE(email,$4::varchar),
         terms_agreed_at=CASE WHEN $6 THEN COALESCE(terms_agreed_at,now()) ELSE terms_agreed_at END,
         privacy_agreed_at=CASE WHEN $6 THEN COALESCE(privacy_agreed_at,now()) ELSE privacy_agreed_at END,
         phone_number=COALESCE($7,phone_number),gender=COALESCE($8,gender),age_range=COALESCE($9,age_range),
         last_login_at=now(),updated_at=now() WHERE id=$1`,
        [userId, requestedNickname, profile.avatarUrl || null, availableEmail,
          Boolean(availableEmail && profile.emailVerified), Boolean(agreements),
          agreements?.phoneNumber || null, agreements?.gender || null, agreements?.ageRange || null],
      );
    }
    if (!userId) throw new Error("OAUTH_USER_CREATION_FAILED");
    await client.query(
      `INSERT INTO user_oauth_accounts(
         user_id,provider,provider_user_id,provider_email,provider_nickname,
         provider_phone_number,provider_gender,provider_age_range,profile
       ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)
       ON CONFLICT(provider,provider_user_id) DO UPDATE SET
         provider_email=EXCLUDED.provider_email,
         provider_nickname=EXCLUDED.provider_nickname,
         provider_phone_number=EXCLUDED.provider_phone_number,
         provider_gender=EXCLUDED.provider_gender,
         provider_age_range=EXCLUDED.provider_age_range,
         profile=EXCLUDED.profile,
         last_login_at=now()`,
      [userId, profile.provider, profile.providerUserId, profile.email || null, profile.nickname || null,
        null, null, null, JSON.stringify(profile.raw)],
    );
    return userId;
}

function getVerifiedOAuthEmail(profile: OAuthProfile) {
  if (!profile.emailVerified || !profile.email) return null;
  const normalized = profile.email.trim().toLowerCase();
  return normalized || null;
}

async function getAvailableOAuthEmail(email: string, userId: string | undefined, client: PoolClient) {
  const duplicate = await client.query(
    `SELECT 1 FROM users
     WHERE lower(email)=lower($1) AND deleted_at IS NULL
       AND ($2::uuid IS NULL OR id<>$2::uuid)
     LIMIT 1`,
    [email, userId || null],
  );
  return duplicate.rowCount ? null : email;
}

async function createAvailableNickname(providerNickname: string | undefined, client: PoolClient) {
  const normalized = (providerNickname || "모두다담")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^가-힣a-z0-9]/gu, "");
  const base = Array.from(normalized || "모두다담").slice(0, 16).join("");

  for (let suffix = 0; suffix < 1000; suffix += 1) {
    const suffixText = suffix ? String(suffix + 1) : "";
    const candidate = `${Array.from(base).slice(0, 20 - suffixText.length).join("")}${suffixText}`;
    const exists = await client.query(
      "SELECT 1 FROM users WHERE lower(nickname)=lower($1) AND deleted_at IS NULL LIMIT 1",
      [candidate],
    );
    if (!exists.rowCount) return candidate;
  }
  return `모두${randomBytes(4).toString("hex")}`.slice(0, 20);
}

type RegisterInput = {
  loginId: string;
  password: string;
  realName: string;
  phoneNumber: string;
  email: string;
};

export async function registerLocalUser(input: RegisterInput) {
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const passwordHash = await hashPassword(input.password);
    const user = await client.query<{ id: string }>(
      `INSERT INTO users(nickname,email,real_name,phone_number,terms_agreed_at,privacy_agreed_at)
       VALUES($1,$2,$3,$4,now(),now()) RETURNING id`,
      [normalizeNickname(input.loginId), input.email, input.realName, input.phoneNumber],
    );
    const userId = user.rows[0].id;
    await ensureAcornWallet(userId, client);
    await client.query(
      `INSERT INTO user_local_accounts(user_id,login_id,password_hash) VALUES($1,$2,$3)`,
      [userId, input.loginId, passwordHash],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function ensureAcornWallet(userId: string, client: PoolClient) {
  await client.query(
    `INSERT INTO acorn_wallets(user_id)
     VALUES($1)
     ON CONFLICT(user_id) DO NOTHING`,
    [userId],
  );
}

export async function loginLocalUser(loginId: string, password: string, userAgent?: string) {
  const client = await db.connect();
  let transactionFinished = false;
  try {
    await client.query("BEGIN");
    const result = await client.query<{
      user_id: string; password_hash: string; failed_login_count: number; locked_until: Date | null;
    }>(
      `SELECT account.user_id,account.password_hash,account.failed_login_count,account.locked_until
       FROM user_local_accounts account JOIN users ON users.id=account.user_id
       WHERE lower(account.login_id)=lower($1) AND users.status='active' AND users.deleted_at IS NULL
       FOR UPDATE`,
      [loginId],
    );
    const account = result.rows[0];
    if (!account) throw new Error("INVALID_CREDENTIALS");
    if (account.locked_until && account.locked_until > new Date()) throw new Error("ACCOUNT_LOCKED");

    if (!(await verifyPassword(password, account.password_hash))) {
      const shouldLock = account.failed_login_count + 1 >= 5;
      await client.query(
        `UPDATE user_local_accounts SET failed_login_count=failed_login_count+1,
         locked_until=CASE WHEN failed_login_count+1>=5 THEN now()+interval '10 minutes' ELSE locked_until END,
         updated_at=now() WHERE user_id=$1`,
        [account.user_id],
      );
      await client.query("COMMIT");
      transactionFinished = true;
      throw new Error(shouldLock ? "ACCOUNT_LOCKED" : "INVALID_CREDENTIALS");
    }

    await client.query("UPDATE user_local_accounts SET failed_login_count=0,locked_until=NULL,updated_at=now() WHERE user_id=$1", [account.user_id]);
    await client.query("UPDATE users SET last_login_at=now(),updated_at=now() WHERE id=$1", [account.user_id]);
    const sessionToken = await createSession(account.user_id, userAgent, client);
    await client.query("COMMIT");
    transactionFinished = true;
    return sessionToken;
  } catch (error) {
    if (!transactionFinished) await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function createSession(userId: string, userAgent?: string, client?: PoolClient) {
  const sessionToken = randomBytes(32).toString("hex");
  await (client ?? db).query(
    `INSERT INTO user_sessions(user_id,token_hash,user_agent,expires_at)
     VALUES($1,$2,$3,now()+interval '14 days')`,
    [userId, hashToken(sessionToken), userAgent || null],
  );
  return sessionToken;
}

export async function revokeSession(token: string) {
  await query("UPDATE user_sessions SET revoked_at=now() WHERE token_hash=$1", [hashToken(token)]);
}
