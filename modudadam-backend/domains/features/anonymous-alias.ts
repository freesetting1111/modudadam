import { randomInt } from "node:crypto";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function createAnonymousAlias(length = 6) {
  return Array.from({ length }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
}
