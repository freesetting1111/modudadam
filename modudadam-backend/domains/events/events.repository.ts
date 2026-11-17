import type { PoolClient, QueryResultRow } from "pg";
import { db, query } from "@/lib/db";

export type EventDefinition = QueryResultRow & {
  id: string;
  event_no: string;
  slug: string;
  title: string;
  description: string | null;
  badge: string | null;
  thumbnail_url: string | null;
  status: "draft" | "active" | "paused" | "ended";
  is_listed: boolean;
  starts_at: Date | string | null;
  ends_at: Date | string | null;
  event_base_url: string | null;
  local_event_base_url: string | null;
  entry_path: string;
  result_path: string | null;
};

export async function findEventByNo(eventNo: string) {
  const result = await query<EventDefinition>(
    `SELECT id,event_no,slug,title,description,badge,thumbnail_url,status,is_listed,
            starts_at,ends_at,event_base_url,local_event_base_url,entry_path,result_path
       FROM event_definitions WHERE event_no=$1 LIMIT 1`,
    [eventNo],
  );
  return result.rows[0] ?? null;
}

export async function findPublicEvents() {
  return (await query<EventDefinition & { participant_count: string }>(
    `SELECT event.id,event.event_no,event.slug,event.title,event.description,event.badge,
            event.thumbnail_url,event.status,event.is_listed,event.starts_at,event.ends_at,
            event.event_base_url,event.local_event_base_url,event.entry_path,event.result_path,
            COUNT(DISTINCT COALESCE(session.user_id::text,session.id::text))::text AS participant_count
       FROM event_definitions event
       LEFT JOIN event_sessions session ON session.event_id=event.id
      WHERE event.is_listed=TRUE AND event.status='active'
        AND (event.starts_at IS NULL OR event.starts_at<=NOW())
        AND (event.ends_at IS NULL OR event.ends_at>=NOW())
      GROUP BY event.id
      ORDER BY event.display_order ASC,event.created_at DESC`,
  )).rows;
}

export async function findActiveUserBySessionHash(sessionHash: string) {
  const result = await query<{ id: string }>(
    `SELECT users.id FROM user_sessions sessions
       JOIN users ON users.id=sessions.user_id
      WHERE sessions.token_hash=$1 AND sessions.revoked_at IS NULL
        AND sessions.expires_at>NOW() AND users.status='active' AND users.deleted_at IS NULL
      LIMIT 1`,
    [sessionHash],
  );
  return result.rows[0]?.id ?? null;
}

export async function createEntryTicket(args: {
  eventId: string; ticketHash: string; userId: string | null;
  sourceSessionHash: string | null; returnPath: string; sourcePath: string | null;
  ipAddress: string | null; userAgent: string | null; expiresAt: Date;
}) {
  await query(
    `INSERT INTO event_entry_tickets(
       event_id,ticket_hash,user_id,source_session_token_hash,return_path,
       source_path,ip_address,user_agent,expires_at
     ) VALUES($1,$2,$3,$4,$5,$6,$7::inet,$8,$9)`,
    [args.eventId,args.ticketHash,args.userId,args.sourceSessionHash,args.returnPath,
      args.sourcePath,args.ipAddress,args.userAgent,args.expiresAt],
  );
}

type TicketRow = QueryResultRow & {
  id: string; event_id: string; event_no: string; status: string;
  starts_at: Date | string | null; ends_at: Date | string | null;
  user_id: string | null; source_session_token_hash: string | null;
  return_path: string; expires_at: Date | string; consumed_at: Date | string | null;
};

export async function consumeEntryTicket(ticketHash: string, eventSessionHash: string) {
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query<TicketRow>(
      `SELECT ticket.id,ticket.event_id,event.event_no,event.status,event.starts_at,event.ends_at,
              ticket.user_id,ticket.source_session_token_hash,ticket.return_path,
              ticket.expires_at,ticket.consumed_at
         FROM event_entry_tickets ticket JOIN event_definitions event ON event.id=ticket.event_id
        WHERE ticket.ticket_hash=$1 LIMIT 1 FOR UPDATE OF ticket`,
      [ticketHash],
    );
    const ticket = result.rows[0];
    if (!ticket) return rollback(client, "invalid_ticket");
    const now = new Date();
    const startsAt = ticket.starts_at ? new Date(ticket.starts_at) : null;
    const endsAt = ticket.ends_at ? new Date(ticket.ends_at) : null;
    if (ticket.status !== "active" || (startsAt && startsAt > now) || (endsAt && endsAt < now)) {
      return rollback(client, "event_inactive");
    }
    if (ticket.consumed_at || new Date(ticket.expires_at) < now) return rollback(client, "expired_ticket");
    const defaultExpiry = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    const expiresAt = endsAt && endsAt < defaultExpiry ? endsAt : defaultExpiry;
    await client.query("UPDATE event_entry_tickets SET consumed_at=NOW() WHERE id=$1", [ticket.id]);
    await client.query(
      `INSERT INTO event_sessions(event_id,entry_ticket_id,session_token_hash,user_id,
                                  source_session_token_hash,expires_at)
       VALUES($1,$2,$3,$4,$5,$6)`,
      [ticket.event_id,ticket.id,eventSessionHash,ticket.user_id,ticket.source_session_token_hash,expiresAt],
    );
    await client.query("COMMIT");
    return { ok: true as const, eventNo: ticket.event_no, returnPath: ticket.return_path, expiresAt };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function rollback(client: PoolClient, reason: string) {
  await client.query("ROLLBACK");
  return { ok: false as const, reason };
}

export async function validateEventSession(eventNo: string, sessionHash: string) {
  const result = await query<{ event_no: string; user_id: string | null; expires_at: Date | string }>(
    `UPDATE event_sessions session SET last_seen_at=NOW()
       FROM event_definitions event
      WHERE event.id=session.event_id AND event.event_no=$1
        AND event.status='active' AND (event.starts_at IS NULL OR event.starts_at<=NOW())
        AND (event.ends_at IS NULL OR event.ends_at>=NOW())
        AND session.session_token_hash=$2 AND session.expires_at>NOW()
      RETURNING event.event_no,session.user_id,session.expires_at`,
    [eventNo, sessionHash],
  );
  return result.rows[0] ?? null;
}
