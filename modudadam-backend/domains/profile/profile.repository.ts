import { randomInt } from "node:crypto";
import { db, query } from "@/lib/db";
import { hashToken } from "@/domains/auth/session";

export type UserProfile = {
  nickname: string;
  statusMessage: string;
  email: string;
  emailVerified: boolean;
  phoneNumber: string;
  gender: string | null;
  ageRange: string | null;
  avatarUrl: string | null;
  provider: "kakao" | "naver" | "local";
  providerNickname: string | null;
};

export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const result = await query<UserProfile>(
    `SELECT users.nickname,
      COALESCE(users.status_message, '') AS "statusMessage",
      COALESCE(users.email, '') AS email,
      (users.email_verified_at IS NOT NULL) AS "emailVerified",
      COALESCE(users.phone_number, '') AS "phoneNumber",
      users.gender,
      users.age_range AS "ageRange",
      users.avatar_url AS "avatarUrl",
      COALESCE(oauth.provider::text, 'local') AS provider,
      oauth.provider_nickname AS "providerNickname"
     FROM users
     LEFT JOIN LATERAL (
       SELECT provider, provider_nickname
       FROM user_oauth_accounts
       WHERE user_id=users.id
       ORDER BY last_login_at DESC
       LIMIT 1
     ) oauth ON true
     WHERE users.id=$1 AND users.deleted_at IS NULL`,
    [userId],
  );
  return result.rows[0] ?? null;
}

export async function isNicknameAvailable(nickname: string, userId: string) {
  const result = await query<{ available: boolean }>(
    `SELECT NOT EXISTS(
       SELECT 1 FROM users
       WHERE lower(nickname)=lower($1) AND id<>$2 AND deleted_at IS NULL
     ) AS available`,
    [nickname, userId],
  );
  return result.rows[0]?.available ?? false;
}

type UpdateProfileInput = {
  nickname: string;
  statusMessage: string | null;
  gender: string | null;
  ageRange: string | null;
};

export async function updateUserProfile(userId: string, input: UpdateProfileInput) {
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const current = await client.query(
      "SELECT 1 FROM users WHERE id=$1 AND deleted_at IS NULL FOR UPDATE",
      [userId],
    );
    if (!current.rows[0]) throw new Error("PROFILE_NOT_FOUND");

    const duplicate = await client.query(
      "SELECT 1 FROM users WHERE lower(nickname)=lower($1) AND id<>$2 AND deleted_at IS NULL LIMIT 1",
      [input.nickname, userId],
    );
    if (duplicate.rowCount) throw new Error("NICKNAME_TAKEN");

    await client.query(
      `UPDATE users
       SET nickname=$2,status_message=$3,gender=$4,age_range=$5,updated_at=now()
       WHERE id=$1`,
      [userId, input.nickname, input.statusMessage, input.gender, input.ageRange],
    );
    await client.query("COMMIT");
    return getUserProfile(userId);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function issueProfileEmailVerification(userId: string, email: string) {
  const duplicate = await query(
    "SELECT 1 FROM users WHERE lower(email)=lower($1) AND id<>$2 AND deleted_at IS NULL LIMIT 1",
    [email, userId],
  );
  if (duplicate.rowCount) throw new Error("EMAIL_TAKEN");
  const recent = await query(
    `SELECT 1 FROM profile_email_verifications
     WHERE user_id=$1 AND created_at>now()-interval '60 seconds' LIMIT 1`,
    [userId],
  );
  if (recent.rowCount) throw new Error("EMAIL_VERIFICATION_RATE_LIMIT");

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      "UPDATE profile_email_verifications SET consumed_at=now() WHERE user_id=$1 AND consumed_at IS NULL",
      [userId],
    );
    const result = await client.query<{ id: string }>(
      `INSERT INTO profile_email_verifications(user_id,email_address,code_hash,expires_at)
       VALUES($1,$2,$3,now()+interval '5 minutes') RETURNING id`,
      [userId, email, hashToken(code)],
    );
    await client.query("COMMIT");
    return { id: result.rows[0].id, code };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}

export async function invalidateProfileEmailVerification(id: string) {
  await query("UPDATE profile_email_verifications SET consumed_at=now() WHERE id=$1", [id]);
}

export async function confirmProfileEmailVerification(userId: string, email: string, code: string) {
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query<{
      id: string; code_hash: string; attempt_count: number; expires_at: Date;
    }>(
      `SELECT id,code_hash,attempt_count,expires_at FROM profile_email_verifications
       WHERE user_id=$1 AND lower(email_address)=lower($2) AND consumed_at IS NULL
       ORDER BY created_at DESC LIMIT 1 FOR UPDATE`,
      [userId, email],
    );
    const verification = result.rows[0];
    const valid = verification && verification.expires_at > new Date()
      && verification.attempt_count < 5 && verification.code_hash === hashToken(code);
    if (!valid) {
      if (verification) await client.query(
        "UPDATE profile_email_verifications SET attempt_count=attempt_count+1 WHERE id=$1",
        [verification.id],
      );
      await client.query("COMMIT");
      return null;
    }
    const duplicate = await client.query(
      "SELECT 1 FROM users WHERE lower(email)=lower($1) AND id<>$2 AND deleted_at IS NULL LIMIT 1",
      [email, userId],
    );
    if (duplicate.rowCount) throw new Error("EMAIL_TAKEN");
    await client.query("UPDATE profile_email_verifications SET consumed_at=now() WHERE id=$1", [verification.id]);
    await client.query(
      "UPDATE users SET email=$2,email_verified_at=now(),updated_at=now() WHERE id=$1",
      [userId, email],
    );
    await client.query("COMMIT");
    return getUserProfile(userId);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}
