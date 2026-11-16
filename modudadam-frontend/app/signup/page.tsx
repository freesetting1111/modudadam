import { redirect } from "next/navigation";

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ returnTo?: string }> }) {
  const query = await searchParams;
  const returnTo = query.returnTo?.startsWith("/") && !query.returnTo.startsWith("//") ? query.returnTo : "/";
  redirect(`/login?returnTo=${encodeURIComponent(returnTo)}`);
}
