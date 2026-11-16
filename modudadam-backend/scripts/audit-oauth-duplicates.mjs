import pg from "pg";

const { Client } = pg;
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL이 설정되지 않았습니다.");

const client = new Client({ connectionString: process.env.DATABASE_URL });

try {
  await client.connect();
  const result = await client.query(`
    WITH identities AS (
      SELECT id AS user_id, lower(email) AS identity
      FROM users
      WHERE email IS NOT NULL AND email_verified_at IS NOT NULL AND deleted_at IS NULL
      UNION
      SELECT user_id, lower(provider_email) AS identity
      FROM user_oauth_accounts
      WHERE provider_email IS NOT NULL
    ), duplicate_groups AS (
      SELECT identity, array_agg(DISTINCT user_id) AS user_ids
      FROM identities
      GROUP BY identity
      HAVING count(DISTINCT user_id) > 1
    ), duplicate_users AS (
      SELECT DISTINCT unnest(user_ids) AS user_id FROM duplicate_groups
    )
    SELECT
      (SELECT count(*)::int FROM duplicate_groups) AS duplicate_identity_groups,
      (SELECT count(*)::int FROM duplicate_users) AS affected_users,
      (SELECT count(*)::int FROM posts WHERE author_id IN (SELECT user_id FROM duplicate_users)) AS posts,
      (SELECT count(*)::int FROM comments WHERE author_id IN (SELECT user_id FROM duplicate_users)) AS comments,
      (SELECT count(*)::int FROM user_records WHERE user_id IN (SELECT user_id FROM duplicate_users)) AS records
  `);
  console.log(result.rows[0]);

  const distribution = await client.query(`
    SELECT
      count(DISTINCT users.id)::int AS active_users,
      count(DISTINCT account.id)::int AS oauth_accounts,
      count(DISTINCT account.user_id) FILTER (WHERE account.provider='naver')::int AS naver_users,
      count(DISTINCT account.user_id) FILTER (WHERE account.provider='kakao')::int AS kakao_users,
      count(DISTINCT account.user_id) FILTER (WHERE account.provider_email IS NOT NULL)::int AS accounts_with_email,
      count(DISTINCT users.id) FILTER (
        WHERE (SELECT count(*) FROM user_oauth_accounts linked WHERE linked.user_id=users.id) > 1
      )::int AS users_with_multiple_providers
    FROM users
    LEFT JOIN user_oauth_accounts account ON account.user_id=users.id
    WHERE users.status='active' AND users.deleted_at IS NULL
  `);
  console.log(distribution.rows[0]);
} finally {
  await client.end();
}
