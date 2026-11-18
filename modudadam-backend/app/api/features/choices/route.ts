import type { NextRequest } from "next/server";
import { getSessionUser, requireSessionUser } from "@/domains/auth/session";
import { corsPreflightResponse, errorResponse, jsonResponse } from "@/lib/http";
import { db, query } from "@/lib/db";

type ChoiceRow = {
  id: string; question: string; description: string | null; activeOn: string;
  optionId: string; label: string; emoji: string | null; sortOrder: number; voteCount: number; myOptionId: string | null;
};

const DAILY_PROMPTS = [
  { question: "하루 동안 한 가지 능력을 가질 수 있다면?", description: "오늘의 선택에 참여하고 다른 사람들의 선택도 확인해 보세요.", options: [["동물과 대화하기", "🐾"], ["어디든 순간이동하기", "✨"]] },
  { question: "쉬는 날, 더 끌리는 쪽은?", description: "정답은 없어요. 지금 마음이 가는 쪽을 골라보세요.", options: [["집에서 온전히 쉬기", "🏠"], ["밖으로 나가 새로운 곳 보기", "🌿"]] },
  { question: "평생 하나만 고른다면?", description: "모두다담 회원들의 취향은 어느 쪽일까요?", options: [["좋아하는 음식 마음껏 먹기", "🍲"], ["좋아하는 여행 마음껏 가기", "🧳"]] },
  { question: "기록으로 더 남기고 싶은 순간은?", description: "나중에 다시 꺼내 보고 싶은 쪽을 골라보세요.", options: [["평범하지만 편안한 하루", "☕"], ["처음 경험한 특별한 하루", "🎈"]] },
  { question: "선물로 하나를 받을 수 있다면?", description: "지금의 나에게 더 필요한 선물은 무엇인가요?", options: [["완전히 자유로운 하루", "🛋️"], ["새로운 취미를 시작할 기회", "🎨"]] },
  { question: "동네에 하나가 생긴다면?", description: "우리 동네에 더 있었으면 하는 공간을 골라보세요.", options: [["늦게까지 여는 조용한 서점", "📚"], ["반려동물과 함께 가는 공원", "🐶"]] },
  { question: "하루를 시작하는 더 좋은 방법은?", description: "내 생활 리듬에 가까운 쪽을 선택해 보세요.", options: [["천천히 준비하는 여유로운 아침", "🌤️"], ["할 일을 바로 시작하는 활기찬 아침", "🏃"]] },
] as const;

export async function GET(request: NextRequest) {
  await ensureTodayChoice();
  const user = await getSessionUser(request);
  const result = await query<ChoiceRow>(
    `WITH selected AS (
       SELECT id,question,description,active_on FROM daily_choices
       WHERE status='published' AND active_on = (now() AT TIME ZONE 'Asia/Seoul')::date
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
    [user?.id || null],
  );
  if (!result.rows.length) return jsonResponse({ choice: null });
  const first = result.rows[0];
  return jsonResponse({ choice: {
    id: first.id, question: first.question, description: first.description, activeOn: first.activeOn,
    myOptionId: first.myOptionId,
    options: result.rows.map((row) => ({ id: row.optionId, label: row.label, emoji: row.emoji, voteCount: row.voteCount })),
  } });
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
       SELECT $1,$2,$3 FROM daily_choice_options WHERE id=$2 AND choice_id=$1
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
  const dayNumber = Math.floor(Date.parse(`${dateText}T00:00:00Z`) / 86_400_000);
  const prompt = DAILY_PROMPTS[((dayNumber % DAILY_PROMPTS.length) + DAILY_PROMPTS.length) % DAILY_PROMPTS.length];
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const choice = await client.query<{ id: string }>(
      `INSERT INTO daily_choices(question,description,active_on) VALUES($1,$2,$3::date)
       ON CONFLICT(active_on) DO UPDATE SET active_on=EXCLUDED.active_on RETURNING id`,
      [prompt.question, prompt.description, dateText],
    );
    for (const [index, [label, emoji]] of prompt.options.entries()) {
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
