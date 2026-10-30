import Image from "next/image";
import { LoginForm } from "@/components/login-form";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ returnTo?: string; oauthError?: string }> }) {
  const query = await searchParams; const returnTo = query.returnTo?.startsWith("/") ? query.returnTo : "/";
  return <section className="login-page auth-page"><Image src="/brand/modudadam-squirrel.png" alt="모두다담 다람쥐" width={120} height={120} priority /><h1>로그인</h1><LoginForm returnTo={returnTo} oauthError={query.oauthError} /></section>;
}
