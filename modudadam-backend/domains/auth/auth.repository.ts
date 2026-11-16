import { randomBytes } from "node:crypto";
import type { PoolClient } from "pg";
import { db, query } from "@/lib/db";
import { hashToken } from "./session";
import { hashPassword, verifyPassword } from "./password";

export type OAuthProvider = "kakao" | "naver";
export type OAuthProfile = {
  provider: OAuthProvider;
  providerUserId: string;
  email?: string;
  nickname?: string;
  avatarUrl?: string;
  phoneNumber?: string;
  gender?: string;
  ageRange?: string;
  raw: Record<string, unknown>;
};

export async function loginOAuthUser(profile: OAuthProfile, userAgent?: string) {
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const account = await client.query<{ user_id: string }>(
      "SELECT user_id FROM user_oauth_accounts WHERE provider=$1 AND provider_user_id=$2 FOR UPDATE",
      [profile.provider, profile.providerUserId],
    );
    let userId = account.rows[0]?.user_id;

    if (!userId) {
      const nickname = await createAvailableNickname(profile.nickname, client);
      const user = await client.query<{ id: string }>(
        `INSERT INTO users(nickname,email,avatar_url,phone_number,gender,age_range,last_login_at)
         VALUES($1,$2,$3,$4,$5,$6,now()) RETURNING id`,
        [nickname, profile.email || null, profile.avatarUrl || null, normalizePhone(profile.phoneNumber), profile.gender || null, profile.ageRange || null],
      );
      userId = user.rows[0].id;
      await client.query(
        `INSERT INTO user_oauth_accounts(
           user_id,provider,provider_user_id,provider_email,provider_nickname,
           provider_phone_number,provider_gender,provider_age_range,profile
         ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)`,
        [userId, profile.provider, profile.providerUserId, profile.email || null, profile.nickname || null,
          profile.phoneNumber || null, profile.gender || null, profile.ageRange || null, JSON.stringify(profile.raw)],
      );
    } else {
      await client.query(
        `UPDATE user_oauth_accounts SET provider_email=$3,provider_nickname=$4,
         provider_phone_number=$5,provider_gender=$6,provider_age_range=$7,profile=$8::jsonb,last_login_at=now()
         WHERE provider=$1 AND provider_user_id=$2`,
        [profile.provider, profile.providerUserId, profile.email || null, profile.nickname || null,
          profile.phoneNumber || null, profile.gender || null, profile.ageRange || null, JSON.stringify(profile.raw)],
      );
      await client.query(
        `UPDATE users SET avatar_url=COALESCE($2,avatar_url),gender=COALESCE($3,gender),
         age_range=COALESCE($4,age_range),email=COALESCE(email,$5),phone_number=COALESCE(phone_number,$6),
         last_login_at=now(),updated_at=now() WHERE id=$1`,
        [userId, profile.avatarUrl || null, profile.gender || null, profile.ageRange || null,
          profile.email || null, normalizePhone(profile.phoneNumber)],
      );
    }

    const sessionToken = await createSession(userId, userAgent, client);
    await client.query("COMMIT");
    return sessionToken;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function createAvailableNickname(providerNickname: string | undefined, client: PoolClient) {
  const normalized = (providerNickname || "모두다담")
    .normalize("NFKC")
    .replace(/[\s\u0000-\u001f\u007f]/gu, "");
  const base = Array.from(normalized || "모두다담").slice(0, 12).join("");

  for (let suffix = 0; suffix < 1000; suffix += 1) {
    const suffixText = suffix ? String(suffix + 1) : "";
    const candidate = `${Array.from(base).slice(0, 12 - suffixText.length).join("")}${suffixText}`;
    const exists = await client.query(
      "SELECT 1 FROM users WHERE lower(nickname)=lower($1) AND deleted_at IS NULL LIMIT 1",
      [candidate],
    );
    if (!exists.rowCount) return candidate;
  }
  return `모두${randomBytes(4).toString("hex")}`.slice(0, 12);
}

function normalizePhone(value: string | undefined) {
  const digits = value?.replace(/\D/g, "") || "";
  const phone = digits.startsWith("82") ? `0${digits.slice(2)}` : digits;
  return /^01[016789]\d{7,8}$/.test(phone) ? phone : null;
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
      [input.loginId, input.email, input.realName, input.phoneNumber],
    );
    const userId = user.rows[0].id;
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
