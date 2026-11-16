import Image from "next/image";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { getServerSessionUser } from "@/lib/auth";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ returnTo?: string; oauthError?: string; provider?: string }> }) {
  const query = await searchParams;
  const returnTo = query.returnTo?.startsWith("/") && !query.returnTo.startsWith("//") ? query.returnTo : "/";
  if (await getServerSessionUser()) redirect(returnTo);
  return <section className="login-v2-page auth-route-page">
    <div className="login-v2-hero">
      <div className="login-v2-mascot"><Image src="/brand/modudadam-squirrel.png" alt="도토리를 안은 모두다담 다람쥐" width={184} height={184} priority /></div>
      <div className="login-v2-copy">
        <h1>일상의 모든 순간을<br /><strong>모두다담</strong>과 함께해요</h1>
        <p>간편하게 로그인하고<br />다양한 생활 이야기를 만나보세요</p>
      </div>
    </div>
    <LoginForm returnTo={returnTo} oauthError={query.oauthError} provider={query.provider} />
  </section>;
}
