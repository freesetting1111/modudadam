import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import pg from "pg";

const { Client } = pg;
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL이 설정되지 않았습니다.");

const client = new Client({ connectionString: process.env.DATABASE_URL });
const dbDirectory = resolve("db");

try {
  await client.connect();
  const files = (await readdir(dbDirectory)).filter((file) => /^\d+.*\.sql$/.test(file)).sort();
  for (const file of files) {
    const sqlPath = resolve(dbDirectory, file);
    await client.query(await readFile(sqlPath, "utf8"));
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
