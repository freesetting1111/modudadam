import type { Metadata } from "next";
import { notFound,redirect } from "next/navigation";
import { Flag } from "lucide-react";
import { getServerSessionUser } from "@/lib/auth";
import { AdminReportReview } from "@/components/admin-report-review";

export const metadata:Metadata={title:"신고 검토",robots:{index:false,follow:false}};
export default async function AdminReportsPage(){const user=await getServerSessionUser();if(!user)redirect("/login?returnTo=/admin/reports");if(user.email?.trim().toLowerCase()!=="freesetting@naver.com")notFound();return <section className="visitor-admin-page"><header className="visitor-admin-heading"><div><small>임시 운영 메뉴</small><h1>신고 검토</h1><p>유효 신고와 기각 신고를 구분합니다.</p></div><span><Flag/></span></header><AdminReportReview/></section>}
