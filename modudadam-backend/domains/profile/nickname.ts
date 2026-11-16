export const NICKNAME_PATTERN = /^[가-힣a-z0-9]{2,20}$/u;

export function normalizeNickname(value: unknown) {
  return String(value ?? "").normalize("NFKC").trim().toLowerCase();
}

export function isValidNickname(value: string) {
  return NICKNAME_PATTERN.test(value);
}
