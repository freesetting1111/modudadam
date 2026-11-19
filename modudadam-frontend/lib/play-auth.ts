import "server-only";

import { redirect } from "next/navigation";
import { getServerSessionUser } from "@/lib/auth";

export const memberContentMetadata = {
  robots: { index: false, follow: false },
} as const;

export async function requirePlayUser(returnTo: `/play/${string}`) {
  const user = await getServerSessionUser();
  if (!user) redirect(`/login?returnTo=${encodeURIComponent(returnTo)}`);
  return user;
}
