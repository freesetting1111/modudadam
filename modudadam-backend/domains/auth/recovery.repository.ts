import { randomInt } from "node:crypto";
import { db, query } from "@/lib/db";
import { hashToken } from "./session";
import { hashPassword } from "./password";
import type { RecoveryPurpose } from "./email";

type IssuedCode = { id: string; email: string; code: string };

export async function issueFindIdCode(realName: string, email: string): Promise<IssuedCode | null> {
  const result = await query<{ user_id: string; email: string }>(
    `SELECT account.user_id,users.email
     FROM user_local_accounts account JOIN users ON users.id=account.user_id
     WHERE users.real_name=$1 AND lower(users.email)=lower($2)
       AND users.status='active' AND users.deleted_at IS NULL`,
    [realName, email],
  );
  return result.rows[0] ? createRecoveryCode(result.rows[0].user_id, result.rows[0].email, "find_id") : null;
}

export async function confirmFindId(email: string, code: string) {
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query<{
      id: string; code_hash: string; attempt_count: number; expires_at: Date; login_id: string;
    }>(
      `SELECT recovery.id,recovery.code_hash,recovery.attempt_count,recovery.expires_at,account.login_id
       FROM account_recovery_codes recovery
       JOIN user_local_accounts account ON account.user_id=recovery.user_id
       WHERE lower(recovery.email_address)=lower($1) AND recovery.purpose='find_id'
         AND recovery.consumed_at IS NULL
       ORDER BY recovery.created_at DESC LIMIT 1 FOR UPDATE`,
      [email],
    );
    const recovery = result.rows[0];
    if (!isValidCode(recovery, code)) {
      if (recovery) await client.query("UPDATE account_recovery_codes SET attempt_count=attempt_count+1 WHERE id=$1", [recovery.id]);
      await client.query("COMMIT");
      return null;
    }
    await client.query("UPDATE account_recovery_codes SET consumed_at=now() WHERE id=$1", [recovery.id]);
    await client.query("COMMIT");
    return maskLoginId(recovery.login_id);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}

export async function issuePasswordResetCode(loginId: string, email: string): Promise<IssuedCode | null> {
  const result = await query<{ user_id: string; email: string }>(
    `SELECT account.user_id,users.email
     FROM user_local_accounts account JOIN users ON users.id=account.user_id
     WHERE lower(account.login_id)=lower($1) AND lower(users.email)=lower($2)
       AND users.status='active' AND users.deleted_at IS NULL`,
    [loginId, email],
  );
  return result.rows[0] ? createRecoveryCode(result.rows[0].user_id, result.rows[0].email, "password_reset") : null;
}

export async function resetPassword(loginId: string, email: string, code: string, newPassword: string) {
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query<{
      id: string; user_id: string; code_hash: string; attempt_count: number; expires_at: Date;
    }>(
      `SELECT recovery.id,recovery.user_id,recovery.code_hash,recovery.attempt_count,recovery.expires_at
       FROM account_recovery_codes recovery
       JOIN user_local_accounts account ON account.user_id=recovery.user_id
       JOIN users ON users.id=account.user_id
       WHERE lower(account.login_id)=lower($1) AND lower(recovery.email_address)=lower($2)
         AND recovery.purpose='password_reset' AND recovery.consumed_at IS NULL AND users.status='active'
       ORDER BY recovery.created_at DESC LIMIT 1 FOR UPDATE`,
      [loginId, email],
    );
    const recovery = result.rows[0];
    if (!isValidCode(recovery, code)) {
      if (recovery) await client.query("UPDATE account_recovery_codes SET attempt_count=attempt_count+1 WHERE id=$1", [recovery.id]);
      await client.query("COMMIT");
      return false;
    }
    const passwordHash = await hashPassword(newPassword);
    await client.query(
      `UPDATE user_local_accounts SET password_hash=$2,password_changed_at=now(),failed_login_count=0,
       locked_until=NULL,updated_at=now() WHERE user_id=$1`,
      [recovery.user_id, passwordHash],
    );
    await client.query("UPDATE account_recovery_codes SET consumed_at=now() WHERE id=$1", [recovery.id]);
    await client.query("UPDATE user_sessions SET revoked_at=now() WHERE user_id=$1 AND revoked_at IS NULL", [recovery.user_id]);
    await client.query("COMMIT");
    return true;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}

export async function invalidateRecoveryCode(id: string) {
  await query("UPDATE account_recovery_codes SET consumed_at=now() WHERE id=$1", [id]);
}

async function createRecoveryCode(userId: string, email: string, purpose: RecoveryPurpose): Promise<IssuedCode> {
  const code = generateRecoveryCode();
  const result = await query<{ id: string }>(
    `INSERT INTO account_recovery_codes(user_id,purpose,email_address,code_hash,expires_at)
     VALUES($1,$2,$3,$4,now()+interval '5 minutes') RETURNING id`,
    [userId, purpose, email.toLowerCase(), hashToken(code)],
  );
  return { id: result.rows[0].id, email, code };
}

function generateRecoveryCode() {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnopqrstuvwxyz";
  const digits = "23456789";
  const symbols = "!@#$%^&*";
  const all = upper + lower + digits + symbols;
  const characters = [pick(upper), pick(lower), pick(digits), pick(symbols)];
  while (characters.length < 8) characters.push(pick(all));
  for (let index = characters.length - 1; index > 0; index--) {
    const target = randomInt(0, index + 1);
    [characters[index], characters[target]] = [characters[target], characters[index]];
  }
  return characters.join("");
}

function pick(characters: string) { return characters[randomInt(0, characters.length)]; }

function isValidCode(recovery: { code_hash: string; attempt_count: number; expires_at: Date } | undefined, code: string) {
  return Boolean(recovery && recovery.expires_at > new Date() && recovery.attempt_count < 5 && recovery.code_hash === hashToken(code));
}

function maskLoginId(loginId: string) {
  if (loginId.length <= 4) return `${loginId.slice(0, 2)}${"*".repeat(Math.max(1, loginId.length - 2))}`;
  return `${loginId.slice(0, 3)}${"*".repeat(loginId.length - 5)}${loginId.slice(-2)}`;
}
