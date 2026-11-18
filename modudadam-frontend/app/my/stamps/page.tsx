import { redirect } from "next/navigation";
import { MyStampManager } from "@/components/dadam-rewards";
import { getServerSessionUser } from "@/lib/auth";
export const metadata = { title:"내 스탬프" };
export default async function MyStampsPage() { const user=await getServerSessionUser(); if (!user) redirect("/login?returnTo=/my/stamps"); return <section className="my-page"><header className="my-page-heading"><h1>내 스탬프</h1></header><MyStampManager/></section>; }
