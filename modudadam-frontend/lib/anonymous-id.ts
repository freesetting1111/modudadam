const ANONYMOUS_KEY = "modudadam_anonymous_id";

export function getAnonymousId() {
  if (typeof window === "undefined") return null;
  let anonymousId = localStorage.getItem(ANONYMOUS_KEY);
  if (!anonymousId) {
    anonymousId = crypto.randomUUID();
    localStorage.setItem(ANONYMOUS_KEY, anonymousId);
  }
  return anonymousId;
}
