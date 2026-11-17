import { redirect } from "next/navigation";
import { buildEventEntryUrl } from "@/lib/event-entry";

export default async function EventEntryPage({
  params, searchParams,
}: {
  params: Promise<{ eventNo: string }>;
  searchParams: Promise<{ next?: string }>;
}) {
  const [{ eventNo }, query] = await Promise.all([params, searchParams]);
  const nextPath = normalizeEventPath(query.next);
  redirect(await buildEventEntryUrl(eventNo, nextPath));
}

function normalizeEventPath(value?: string) {
  if (!value) return "/events/welcome";
  const parsed = new URL(value, "https://event.local");
  return parsed.pathname.startsWith("/events/") ? `${parsed.pathname}${parsed.search}` : "/events/welcome";
}
