const ANONYMOUS_KEY = "modudadam_anonymous_id";
let cachedAnonymousId: string | null = null;

export function getAnonymousId() {
  if (typeof window === "undefined") return null;
  if (cachedAnonymousId) return cachedAnonymousId;
  let anonymousId: string | null = null;
  try { anonymousId = localStorage.getItem(ANONYMOUS_KEY); } catch { /* 저장소가 막혀도 현재 페이지에서는 같은 ID를 씁니다. */ }
  if (!anonymousId) {
    anonymousId = crypto.randomUUID();
    try { localStorage.setItem(ANONYMOUS_KEY, anonymousId); } catch { /* 메모리 캐시로 대체합니다. */ }
  }
  cachedAnonymousId = anonymousId;
  return cachedAnonymousId;
}
