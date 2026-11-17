import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import pg from "pg";

const { Client } = pg;
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL이 설정되지 않았습니다.");

const client = new Client({ connectionString: process.env.DATABASE_URL });
const dbDirectory = resolve("db");

try {
  await client.connect();
  await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    filename varchar(255) PRIMARY KEY,
    checksum char(64) NOT NULL,
    applied_at timestamptz NOT NULL DEFAULT now()
  )`);
  const files = (await readdir(dbDirectory)).filter((file) => /^\d+.*\.sql$/.test(file)).sort();
  for (const file of files) {
    const sqlPath = resolve(dbDirectory, file);
    const sql = await readFile(sqlPath, "utf8");
    const checksum = createHash("sha256").update(sql).digest("hex");
    const existing = await client.query("SELECT checksum FROM schema_migrations WHERE filename=$1", [file]);
    if (existing.rows[0]) {
      if (existing.rows[0].checksum !== checksum) {
        throw new Error(`이미 적용된 마이그레이션 파일이 변경되었습니다: ${file}`);
      }
      console.log(`Skipped ${sqlPath}`);
      continue;
    }
    await client.query(sql);
    await client.query("INSERT INTO schema_migrations(filename,checksum) VALUES($1,$2)", [file, checksum]);
    console.log(`Applied ${sqlPath}`);
  }
  const verification = await client.query(
    `SELECT (SELECT count(*)::int FROM categories) AS categories,
      (SELECT count(*)::int FROM boards) AS boards,
      to_regclass('public.user_local_accounts') IS NOT NULL AS local_accounts,
      to_regclass('public.account_recovery_codes') IS NOT NULL AS account_recovery`,
  );
  console.log("Verified", verification.rows[0]);
} finally {
  await client.end();
}
