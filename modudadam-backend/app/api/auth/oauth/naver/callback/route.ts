import { handleOAuthCallback } from "@/domains/auth/oauth";
import type { NextRequest } from "next/server";
export function GET(request: NextRequest) { return handleOAuthCallback("naver", request); }
