import type { NextRequest } from "next/server";
import { settleDueChoiceRewards } from "@/lib/daily-choice-rewards";
import { errorResponse, jsonResponse } from "@/lib/http";

export async function GET(request:NextRequest) {
  const secret=process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization")!==`Bearer ${secret}`) return errorResponse("Unauthorized",401);
  try {
    const result=await settleDueChoiceRewards();
    return jsonResponse({ ok:true,...result });
  } catch(error) {
    console.error("[daily-choice-rewards] settlement failed",error);
    return errorResponse("극한 밸런스 보상 정산에 실패했습니다.",500);
  }
}
