"use client";

import { CheckCircle2, XCircle } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";

type Report={ id:string;targetType:"post"|"comment";reasonCode:string;reasonDetail:string|null;createdAt:string;reporterName:string;targetName:string;targetContent:string };
type Data={ reports:Report[];total:number;page:number;totalPages:number };

export function AdminReportReview(){
  const [data,setData]=useState<Data|null>(null);const [page,setPage]=useState(1);const [pending,setPending]=useState("");const [error,setError]=useState("");
  const load=useCallback(() => apiRequest<Data>(`/api/admin/reports?status=pending&page=${page}`,{ cache:"no-store" }).then(setData).catch((caught) => setError(caught instanceof Error ? caught.message : "신고를 불러오지 못했습니다.")),[page]);
  useEffect(() => { void load(); },[load]);
  async function review(id:string,status:"actioned"|"dismissed"){setPending(id);setError("");try{await apiRequest("/api/admin/reports",{method:"POST",body:JSON.stringify({id,status})});await load();}catch(caught){setError(caught instanceof Error ? caught.message : "처리하지 못했습니다.");}finally{setPending("");}}
  return <div className="admin-report-review"><div className="visitor-result-summary"><strong>검토 대기 {data?.total.toLocaleString() || 0}건</strong><span>유효 처리된 신고만 악행 랭킹에 반영됩니다.</span></div>{error&&<p className="form-error">{error}</p>}<div className="admin-report-list">{data?.reports.length ? data.reports.map((report)=><article key={report.id}><header><strong>{report.targetName}</strong><span>{report.targetType==="post"?"게시글":"댓글"} 신고</span></header><p>{report.targetContent}</p><dl><div><dt>사유</dt><dd>{report.reasonCode}{report.reasonDetail?` · ${report.reasonDetail}`:""}</dd></div><div><dt>신고자</dt><dd>{report.reporterName}</dd></div><div><dt>접수</dt><dd>{new Date(report.createdAt).toLocaleString("ko-KR")}</dd></div></dl><footer><button type="button" disabled={Boolean(pending)} onClick={()=>void review(report.id,"dismissed")}><XCircle/>기각</button><button type="button" disabled={Boolean(pending)} onClick={()=>void review(report.id,"actioned")}><CheckCircle2/>유효 처리</button></footer></article>) : <div className="visitor-admin-empty"><CheckCircle2/><strong>검토할 신고가 없습니다.</strong></div>}</div>{data&&data.totalPages>1&&<nav className="feature-pagination"><button disabled={page<=1} onClick={()=>setPage(page-1)}>이전</button><span>{page} / {data.totalPages}</span><button disabled={page>=data.totalPages} onClick={()=>setPage(page+1)}>다음</button></nav>}</div>;
}
