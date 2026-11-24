import type { NextRequest } from "next/server";
import { getSessionUser } from "@/domains/auth/session";
import { query } from "@/lib/db";
import { corsPreflightResponse, errorResponse, jsonResponse } from "@/lib/http";

type CatalogRow = {
  groupCode:string;groupTitle:string;groupDescription:string;groupIcon:string;
  itemCode:string;href:string;itemTitle:string;label:string;itemDescription:string;
  itemIcon:string;tone:"blue"|"coral"|"amber"|"green"|"purple";requiresAuth:boolean;
};

type DailyStateRow = {
  attendanceDone:boolean;choiceDone:boolean;detectiveStatus:string|null;
  missionCompleted:number;pendingGifts:number;
};

const placements = new Set(["primary","daily","group","quick_nav"]);

export async function GET(request:NextRequest) {
  try {
    const user=await getSessionUser(request);
    const [catalog,bountyCount,stateResult]=await Promise.all([
      query<CatalogRow>(
        `SELECT groups.code AS "groupCode",groups.title AS "groupTitle",
                groups.description AS "groupDescription",groups.icon AS "groupIcon",
                items.code AS "itemCode",items.href,items.title AS "itemTitle",
                items.label,items.description AS "itemDescription",items.icon AS "itemIcon",items.tone,
                COALESCE(
                  (to_jsonb(items)->>'requires_auth')::boolean,
                  items.code IN ('attendance','choice','detective','missions','acorn-gift','stamps')
                ) AS "requiresAuth"
           FROM content_hub_groups groups
           JOIN content_hub_items items ON items.group_code=groups.code AND items.enabled
          WHERE groups.enabled
          ORDER BY groups.sort_order,items.sort_order,items.code`,
      ),
      query<{ count:number }>(`SELECT count(*)::int AS count FROM post_acorn_bounties WHERE status='open' AND expires_at>now()`),
      user ? loadUserState(user.id) : Promise.resolve({ rows:[] } as { rows:DailyStateRow[] }),
    ]);

    const state=stateResult.rows[0];
    const itemStates:Record<string,{ state:"todo"|"active"|"done"|"locked";label:string }>={};
    if (!user) {
      for (const item of catalog.rows) {
        if (item.requiresAuth) itemStates[item.itemCode]={ state:"locked",label:"로그인 필요" };
      }
    } else if (state) {
      itemStates.attendance=state.attendanceDone ? { state:"done",label:"완료" } : { state:"todo",label:"출석하기" };
      itemStates.choice=state.choiceDone ? { state:"done",label:"참여 완료" } : { state:"todo",label:"선택하기" };
      itemStates.detective=state.detectiveStatus==="solved" || state.detectiveStatus==="failed"
        ? { state:"done",label:"수사 완료" }
        : state.detectiveStatus==="active" ? { state:"active",label:"수사 중" } : { state:"todo",label:"시작하기" };
      itemStates.missions=state.missionCompleted>0
        ? { state:"done",label:`${state.missionCompleted}개 완료` }
        : { state:"todo",label:"문제 풀기" };
      if (state.pendingGifts>0) itemStates["acorn-gift"]={ state:"active",label:`받을 선물 ${state.pendingGifts}개` };
    }

    const groups:Array<{ code:string;title:string;description:string;icon:string;items:Array<Record<string,unknown>> }>=[];
    for (const row of catalog.rows) {
      let group=groups.find((item)=>item.code===row.groupCode);
      if (!group) {
        group={ code:row.groupCode,title:row.groupTitle,description:row.groupDescription,icon:row.groupIcon,items:[] };
        groups.push(group);
      }
      group.items.push({
        code:row.itemCode,href:row.href,title:row.itemTitle,label:row.label,
        description:row.itemDescription,icon:row.itemIcon,tone:row.tone,requiresAuth:row.requiresAuth,
        status:itemStates[row.itemCode] || null,
      });
    }

    const dailyCompleted=[state?.attendanceDone,state?.choiceDone,state?.detectiveStatus==="solved" || state?.detectiveStatus==="failed",Boolean(state?.missionCompleted)].filter(Boolean).length;
    return jsonResponse({ authenticated:Boolean(user),openBountyCount:bountyCount.rows[0]?.count || 0,dailyCompleted,dailyTotal:4,groups });
  } catch (error) {
    console.error("[content-hub] failed to load",error);
    return errorResponse("콘텐츠를 불러오지 못했습니다.",500);
  }
}

export async function POST(request:NextRequest) {
  try {
    const user=await getSessionUser(request);
    const body=await request.json() as { itemCode?:unknown;placement?:unknown;visitorKey?:unknown };
    const itemCode=String(body.itemCode || "").trim();
    const placement=String(body.placement || "").trim();
    const visitorKey=String(body.visitorKey || "").trim().slice(0,100) || null;
    if (!/^[a-z0-9-]{2,40}$/.test(itemCode) || !placements.has(placement)) return errorResponse("기록 정보가 올바르지 않습니다.");
    const saved=await query(
      `INSERT INTO content_hub_interactions(item_code,placement,user_id,visitor_key)
       SELECT code,$2,$3::uuid,$4 FROM content_hub_items WHERE code=$1 AND enabled
       RETURNING id`,
      [itemCode,placement,user?.id || null,visitorKey],
    );
    if (!saved.rows[0]) return errorResponse("콘텐츠를 찾을 수 없습니다.",404);
    return jsonResponse({ recorded:true });
  } catch (error) {
    console.error("[content-hub] failed to record interaction",error);
    return errorResponse("선택 기록을 저장하지 못했습니다.",500);
  }
}

function loadUserState(userId:string) {
  return query<DailyStateRow>(
    `SELECT
       EXISTS(SELECT 1 FROM attendance_checkins WHERE user_id=$1 AND attendance_on=(now() AT TIME ZONE 'Asia/Seoul')::date) AS "attendanceDone",
       EXISTS(SELECT 1 FROM daily_choice_votes votes JOIN daily_choices choices ON choices.id=votes.choice_id
               WHERE votes.user_id=$1 AND choices.active_on=(now() AT TIME ZONE 'Asia/Seoul')::date) AS "choiceDone",
       (SELECT status FROM detective_daily_attempts WHERE user_id=$1 AND play_on=(now() AT TIME ZONE 'Asia/Seoul')::date LIMIT 1) AS "detectiveStatus",
       (SELECT count(*)::int FROM daily_mission_attempts WHERE user_id=$1
         AND mission_on=(now() AT TIME ZONE 'Asia/Seoul')::date AND completed_at IS NOT NULL) AS "missionCompleted",
       (SELECT count(*)::int FROM acorn_gifts WHERE recipient_id=$1 AND status IN ('sent','viewed')) AS "pendingGifts"`,
    [userId],
  );
}

export function OPTIONS() { return corsPreflightResponse(); }
