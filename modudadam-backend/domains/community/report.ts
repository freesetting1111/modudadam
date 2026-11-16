export const REPORT_REASONS = [
  "스팸·홍보/도배",
  "욕설·비방·혐오 표현",
  "음란물·부적절한 콘텐츠",
  "개인정보 노출",
  "허위사실·사기",
  "게시판 성격에 맞지 않음",
  "기타",
] as const;

export function parseReport(value: unknown) {
  const body = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const reasonCode = body.reasonCode;
  if (typeof reasonCode !== "string" || !REPORT_REASONS.includes(reasonCode as typeof REPORT_REASONS[number])) {
    throw new Error("REPORT_REASON_REQUIRED");
  }
  const reasonDetail = reasonCode === "기타" && typeof body.reasonDetail === "string" ? body.reasonDetail.trim() : "";
  if (reasonCode === "기타" && !reasonDetail) throw new Error("REPORT_DETAIL_REQUIRED");
  if (reasonDetail.length > 1000) throw new Error("REPORT_DETAIL_TOO_LONG");
  return { reasonCode, reasonDetail: reasonDetail || null };
}

export function reportErrorResponse(error: unknown) {
  if (!(error instanceof Error)) return null;
  if (error.message === "REPORT_REASON_REQUIRED") return "신고 사유를 선택해 주세요.";
  if (error.message === "REPORT_DETAIL_REQUIRED") return "기타 신고 사유를 입력해 주세요.";
  if (error.message === "REPORT_DETAIL_TOO_LONG") return "신고 상세 사유는 1,000자 이내로 입력해 주세요.";
  return null;
}
