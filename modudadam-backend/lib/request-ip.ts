import { isIP } from "node:net";
import type { NextRequest } from "next/server";

export function getRequestIp(request: NextRequest) {
  const candidates = [
    request.headers.get("x-modudadam-client-ip"),
    request.headers.get("cf-connecting-ip"),
    request.headers.get("x-real-ip"),
    request.headers.get("x-vercel-forwarded-for"),
    request.headers.get("x-forwarded-for"),
  ];

  for (const header of candidates) {
    for (const rawValue of header?.split(",") || []) {
      let value = rawValue.trim();
      if (value.startsWith("[") && value.includes("]")) value = value.slice(1, value.indexOf("]"));
      if (/^\d{1,3}(?:\.\d{1,3}){3}:\d+$/.test(value)) value = value.slice(0, value.lastIndexOf(":"));
      if (isIP(value)) return value;
    }
  }
  return null;
}
