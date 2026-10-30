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
      const user = await client.query<{ id: string }>(
        `INSERT INTO users(nickname, email, avatar_url, last_login_at)
         VALUES($1,$2,$3,now()) RETURNING id`,
        [profile.nickname || "모두다담 사용자", profile.email || null, profile.avatarUrl || null],
      );
      userId = user.rows[0].id;
      await client.query(
        `INSERT INTO user_oauth_accounts(user_id,provider,provider_user_id,provider_email,profile)
         VALUES($1,$2,$3,$4,$5::jsonb)`,
        [userId, profile.provider, profile.providerUserId, profile.email || null, JSON.stringify(profile.raw)],
      );
    } else {
      await client.query(
        `UPDATE user_oauth_accounts SET provider_email=$3, profile=$4::jsonb, last_login_at=now()
         WHERE provider=$1 AND provider_user_id=$2`,
        [profile.provider, profile.providerUserId, profile.email || null, JSON.stringify(profile.raw)],
      );
      await client.query(
        "UPDATE users SET nickname=COALESCE($2,nickname), avatar_url=COALESCE($3,avatar_url), last_login_at=now(), updated_at=now() WHERE id=$1",
        [userId, profile.nickname || null, profile.avatarUrl || null],
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

type RegisterInput = {
  loginId: string;
  password: string;
  realName: string;
  phoneNumber: string;
  email: string;
};

export async function registerLocalUser(input: RegisterInput, userAgent?: string) {
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const passwordHash = await hashPassword(input.password);
    const user = await client.query<{ id: string }>(
      `INSERT INTO users(nickname,email,real_name,phone_number,terms_agreed_at,privacy_agreed_at,last_login_at)
       VALUES($1,$2,$3,$4,now(),now(),now()) RETURNING id`,
      [input.loginId, input.email, input.realName, input.phoneNumber],
    );
    const userId = user.rows[0].id;
    await client.query(
      `INSERT INTO user_local_accounts(user_id,login_id,password_hash) VALUES($1,$2,$3)`,
      [userId, input.loginId, passwordHash],
    );
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
    if (!account || (account.locked_until && account.locked_until > new Date())) throw new Error("INVALID_CREDENTIALS");

    if (!(await verifyPassword(password, account.password_hash))) {
      await client.query(
        `UPDATE user_local_accounts SET failed_login_count=failed_login_count+1,
         locked_until=CASE WHEN failed_login_count+1>=5 THEN now()+interval '10 minutes' ELSE locked_until END,
         updated_at=now() WHERE user_id=$1`,
        [account.user_id],
      );
      await client.query("COMMIT");
      transactionFinished = true;
      throw new Error("INVALID_CREDENTIALS");
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
