import { redirect } from "next/navigation";
import { AcornGiftInbox } from "@/components/acorn-gift-inbox";
import { getServerSessionUser } from "@/lib/auth";

export const metadata={ title:"내 선물함" };

export default async function MyGiftsPage() {
  if(!await getServerSessionUser()) redirect("/login?returnTo=/my/gifts");
  return <AcornGiftInbox/>;
}
