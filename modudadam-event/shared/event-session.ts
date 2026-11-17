import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const EVENT_SESSION_COOKIE = "modudadam_event_session";
const backendUrl = (process.env.MODUDADAM_BACKEND_URL || "http://localhost:3004").replace(/\/$/, "");

export async function requireEventSession(eventNo: string, nextPath: string) {
  const token = (await cookies()).get(EVENT_SESSION_COOKIE)?.value;
  if (!token) redirect(buildMainEntryUrl(eventNo, nextPath));
  const response = await fetch(`${backendUrl}/api/events/sessions/validate`, {
    method: "POST", cache: "no-store", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ eventNo, eventSessionToken: token }),
  });
  if (!response.ok) redirect(buildMainEntryUrl(eventNo, nextPath));
}

function buildMainEntryUrl(eventNo: string, nextPath: string) {
  const url = new URL(`/events/${encodeURIComponent(eventNo)}`, process.env.MODUDADAM_MAIN_URL || "http://localhost:3005");
  url.searchParams.set("next", nextPath);
  return url.toString();
}
