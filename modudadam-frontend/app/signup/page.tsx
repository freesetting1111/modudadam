import Image from "next/image";
import { SignupForm } from "@/components/signup-form";

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ returnTo?: string }> }) {
  const query = await searchParams;
  const returnTo = query.returnTo?.startsWith("/") && !query.returnTo.startsWith("//") ? query.returnTo : "/";
  return <section className="content-page signup-page">
    <div className="signup-heading"><Image src="/brand/modudadam-squirrel.png" alt="" width={72} height={72} /><div><h1>회원가입</h1><p>모두다담에서 생활 정보와 이야기를 나눠보세요.</p></div></div>
    <SignupForm returnTo={returnTo} />
  </section>;
}
