import type { PoolClient } from "pg";
import { createAnonymousAlias } from "@/domains/features/anonymous-alias";

export async function getOrCreateMailboxAlias(client: PoolClient, userId: string) {
  const existing = await client.query<{ anonymousAlias: string }>(
    `SELECT anonymous_alias AS "anonymousAlias" FROM mailbox_user_aliases WHERE user_id=$1`, [userId],
  );
  if (existing.rows[0]) return existing.rows[0].anonymousAlias;
  for (let attempt=0; attempt<10; attempt+=1) {
    const alias = createAnonymousAlias(8);
    const inserted = await client.query<{ anonymousAlias: string }>(
      `INSERT INTO mailbox_user_aliases(user_id,anonymous_alias) VALUES($1,$2)
       ON CONFLICT DO NOTHING RETURNING anonymous_alias AS "anonymousAlias"`, [userId,alias],
    );
    if (inserted.rows[0]) return inserted.rows[0].anonymousAlias;
    const retried = await client.query<{ anonymousAlias: string }>(
      `SELECT anonymous_alias AS "anonymousAlias" FROM mailbox_user_aliases WHERE user_id=$1`, [userId],
    );
    if (retried.rows[0]) return retried.rows[0].anonymousAlias;
  }
  throw new Error("ALIAS_FAILED");
}
