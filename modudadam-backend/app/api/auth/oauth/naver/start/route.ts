import { startOAuth } from "@/domains/auth/oauth";
import type { NextRequest } from "next/server";
export function GET(request: NextRequest) { return startOAuth("naver", request); }
