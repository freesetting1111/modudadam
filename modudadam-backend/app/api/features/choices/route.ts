import type { NextRequest } from "next/server";
import { getSessionUser, requireSessionUser } from "@/domains/auth/session";
import { corsPreflightResponse, errorResponse, jsonResponse } from "@/lib/http";
import { db, query } from "@/lib/db";

type ChoiceRow = {
  id: string; question: string; description: string | null; activeOn: string;
  optionId: string; label: string; emoji: string | null; sortOrder: number; voteCount: number; myOptionId: string | null;
};

export async function GET(request: NextRequest) {
  await ensureTodayChoice();
  const user = await getSessionUser(request);
  const bank = await query<{ count: number; remaining: number }>(
    `SELECT COUNT(*)::int AS count,
            COUNT(*) FILTER(WHERE NOT EXISTS(
              SELECT 1 FROM daily_choices choices WHERE choices.source_prompt_id=prompts.id
            ))::int AS remaining
       FROM choice_prompt_bank prompts WHERE enabled`,
  );
  const [choice, previousChoice] = await Promise.all([
    findChoice(user?.id || null, 0),
    findChoice(user?.id || null, 1),
  ]);
  return jsonResponse({ choice, previousChoice, questionBankSize: bank.rows[0]?.count || 0, remainingQuestionCount: bank.rows[0]?.remaining || 0 });
}

async function findChoice(userId: string | null, daysAgo: number) {
  const result = await query<ChoiceRow>(
    `WITH selected AS (
       SELECT id,question,description,active_on FROM daily_choices
       WHERE status='published' AND active_on = (now() AT TIME ZONE 'Asia/Seoul')::date - $2::int
       LIMIT 1
     )
     SELECT selected.id,selected.question,selected.description,selected.active_on::text AS "activeOn",
       options.id AS "optionId",options.label,options.emoji,options.sort_order AS "sortOrder",
       COUNT(votes.user_id)::int AS "voteCount",mine.option_id AS "myOptionId"
     FROM selected JOIN daily_choice_options options ON options.choice_id=selected.id
     LEFT JOIN daily_choice_votes votes ON votes.option_id=options.id
     LEFT JOIN daily_choice_votes mine ON mine.choice_id=selected.id AND mine.user_id=$1::uuid
     GROUP BY selected.id,selected.question,selected.description,selected.active_on,
       options.id,options.label,options.emoji,options.sort_order,mine.option_id
     ORDER BY options.sort_order`,
    [userId, daysAgo],
  );
  if (!result.rows.length) return null;
  const first = result.rows[0];
  return {
    id: first.id, question: first.question, description: first.description, activeOn: first.activeOn,
    myOptionId: first.myOptionId,
    options: result.rows.map((row) => ({ id: row.optionId, label: row.label, emoji: row.emoji, voteCount: row.voteCount })),
  };
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireSessionUser(request);
    const body = await request.json();
    const choiceId = String(body.choiceId || "");
    const optionId = String(body.optionId || "");
    if (!isUuid(choiceId) || !isUuid(optionId)) return errorResponse("선택 정보가 올바르지 않습니다.");
    const saved = await query(
      `INSERT INTO daily_choice_votes(choice_id,option_id,user_id)
       SELECT options.choice_id,options.id,$3
       FROM daily_choice_options options JOIN daily_choices choices ON choices.id=options.choice_id
       WHERE options.id=$2 AND options.choice_id=$1 AND choices.status='published'
         AND choices.active_on=(now() AT TIME ZONE 'Asia/Seoul')::date
       ON CONFLICT(choice_id,user_id) DO UPDATE SET option_id=EXCLUDED.option_id,updated_at=now()
       RETURNING option_id`,
      [choiceId, optionId, user.id],
    );
    if (!saved.rows[0]) return errorResponse("선택 항목을 찾을 수 없습니다.", 404);
    return jsonResponse({ optionId });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return errorResponse("로그인이 필요합니다.", 401);
    return errorResponse("선택을 저장하지 못했습니다.", 500);
  }
}

function isUuid(value: string) { return /^[0-9a-f-]{36}$/i.test(value); }

async function ensureTodayChoice() {
  const dateText = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const existing = await client.query(`SELECT id FROM daily_choices WHERE active_on=$1::date LIMIT 1`,[dateText]);
    if (existing.rows[0]) { await client.query("COMMIT"); return; }
    const prompt = await client.query<{
      id: string; question: string; description: string | null;
      optionALabel: string; optionAEmoji: string | null; optionBLabel: string; optionBEmoji: string | null;
    }>(
      `SELECT id::text,question,description,option_a_label AS "optionALabel",option_a_emoji AS "optionAEmoji",
              option_b_label AS "optionBLabel",option_b_emoji AS "optionBEmoji"
         FROM choice_prompt_bank prompts
        WHERE enabled AND NOT EXISTS(
          SELECT 1 FROM daily_choices choices WHERE choices.source_prompt_id=prompts.id
        )
        ORDER BY md5(prompts.id::text || $1)
        FOR UPDATE SKIP LOCKED LIMIT 1`,
      [dateText],
    );
    if (!prompt.rows[0]) { await client.query("COMMIT"); return; }
    const selected = prompt.rows[0];
    const choice = await client.query<{ id: string }>(
      `INSERT INTO daily_choices(question,description,active_on,source_prompt_id) VALUES($1,$2,$3::date,$4::bigint)
       ON CONFLICT(active_on) DO NOTHING RETURNING id`,
      [selected.question, selected.description, dateText, selected.id],
    );
    if (!choice.rows[0]) { await client.query("COMMIT"); return; }
    const options = [[selected.optionALabel, selected.optionAEmoji], [selected.optionBLabel, selected.optionBEmoji]];
    for (const [index, [label, emoji]] of options.entries()) {
      await client.query(
        `INSERT INTO daily_choice_options(choice_id,label,emoji,sort_order) VALUES($1,$2,$3,$4)
         ON CONFLICT(choice_id,sort_order) DO NOTHING`, [choice.rows[0].id, label, emoji, index + 1],
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}
export function OPTIONS() { return corsPreflightResponse(); }
