import { db, query } from "@/lib/db";

export type UserProfile = {
  nickname: string;
  statusMessage: string;
  email: string;
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
  email: string | null;
  phoneNumber: string | null;
};

export async function updateUserProfile(userId: string, input: UpdateProfileInput) {
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const current = await client.query<{ email: string | null; phone_number: string | null }>(
      "SELECT email,phone_number FROM users WHERE id=$1 AND deleted_at IS NULL FOR UPDATE",
      [userId],
    );
    if (!current.rows[0]) throw new Error("PROFILE_NOT_FOUND");

    const duplicate = await client.query(
      "SELECT 1 FROM users WHERE lower(nickname)=lower($1) AND id<>$2 AND deleted_at IS NULL LIMIT 1",
      [input.nickname, userId],
    );
    if (duplicate.rowCount) throw new Error("NICKNAME_TAKEN");

    const emailChanged = (current.rows[0].email ?? "").toLowerCase() !== (input.email ?? "").toLowerCase();
    const phoneChanged = (current.rows[0].phone_number ?? "") !== (input.phoneNumber ?? "");
    await client.query(
      `UPDATE users
       SET nickname=$2,status_message=$3,email=$4,phone_number=$5,
         email_verified_at=CASE WHEN $6 THEN NULL ELSE email_verified_at END,
         phone_verified_at=CASE WHEN $7 THEN NULL ELSE phone_verified_at END,
         updated_at=now()
       WHERE id=$1`,
      [userId, input.nickname, input.statusMessage, input.email, input.phoneNumber, emailChanged, phoneChanged],
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
