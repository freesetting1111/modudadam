import "server-only";
import { createHash, createHmac, randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { API_SERVER_URL } from "./server-config";

const SESSION_COOKIE = "modudadam_session";
const LOCAL_SECRET = "local-modudadam-event-gateway-secret";

export async function buildEventEntryUrl(eventNo: string, nextPath: string) {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const body = Buffer.from(JSON.stringify({
    eventNo,
    nextPath,
    sessionHash: token ? createHash("sha256").update(token).digest("hex") : null,
    iat: Date.now(),
    nonce: randomUUID(),
  }), "utf8").toString("base64url");
  const signature = createHmac("sha256", gatewaySecret()).update(body).digest("base64url");
  const url = new URL(`/api/events/entry/${encodeURIComponent(eventNo)}`, API_SERVER_URL);
  url.searchParams.set("next", nextPath);
  url.searchParams.set("launchToken", `${body}.${signature}`);
  return url.toString();
}

function gatewaySecret() {
  if (process.env.EVENT_GATEWAY_SHARED_SECRET) return process.env.EVENT_GATEWAY_SHARED_SECRET;
  if (process.env.NODE_ENV === "production") throw new Error("EVENT_GATEWAY_SHARED_SECRET is required in production.");
  return LOCAL_SECRET;
}
