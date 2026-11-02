import Image from "next/image";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { getServerSessionUser } from "@/lib/auth";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ returnTo?: string; oauthError?: string; registered?: string }> }) {
  const query = await searchParams;
  const returnTo = query.returnTo?.startsWith("/") && !query.returnTo.startsWith("//") ? query.returnTo : "/";
  if (await getServerSessionUser()) redirect(returnTo);
  return <section className="login-page auth-page"><Image src="/brand/modudadam-squirrel.png" alt="모두다담 다람쥐" width={120} height={120} priority /><h1>로그인</h1><LoginForm returnTo={returnTo} oauthError={query.oauthError} registered={query.registered === "true"} /></section>;
}
