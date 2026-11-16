"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Check, ChevronRight, ShieldCheck, X } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { TermsContent } from "@/components/signup-form";

type PendingProfile = { provider: "naver" | "kakao"; nickname: string | null };

export function OAuthAgreements({ ticket }: { ticket: string }) {
  const router = useRouter();
  const [profile, setProfile] = useState<PendingProfile | null>(null);
  const [ageOver14, setAgeOver14] = useState(false);
  const [agreementComplete, setAgreementComplete] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [termsRead, setTermsRead] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(ticket ? "" : "가입 인증 정보가 없습니다. 다시 로그인해 주세요.");

  useEffect(() => {
    if (!ticket) return;
    apiRequest<PendingProfile>(`/api/auth/signup/agreements?ticket=${encodeURIComponent(ticket)}`, { cache: "no-store" })
      .then(setProfile)
      .catch((caught) => setError(caught instanceof Error ? caught.message : "가입 정보를 확인하지 못했습니다."));
  }, [ticket]);

  useEffect(() => {
    if (!modalOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [modalOpen]);

  async function completeSignup() {
    if (!ageOver14 || !agreementComplete) return;
    setPending(true); setError("");
    try {
      const result = await apiRequest<{ returnTo: string }>("/api/auth/signup/agreements", {
        method: "POST",
        body: JSON.stringify({ ticket, ageOver14: true, agreeTerms: true, agreePrivacy: true }),
      });
      router.replace(result.returnTo || "/");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "가입을 완료하지 못했습니다.");
      setPending(false);
    }
  }

  const ready = Boolean(profile) && ageOver14 && agreementComplete;
  return <section className="oauth-agreement-page auth-route-page">
    <div className="oauth-agreement-heading">
      <span><ShieldCheck size={25} /></span>
      <div><small>{profile?.provider === "kakao" ? "카카오" : "네이버"} 계정으로 계속하기</small><h1>약관에 동의해 주세요</h1><p>모두다담을 이용하기 위한 필수 항목이에요.</p></div>
    </div>
    <div className="oauth-agreement-card">
      <button type="button" className={`oauth-consent-row ${ageOver14 ? "checked" : ""}`} onClick={() => setAgeOver14((value) => !value)}>
        <span className="oauth-consent-check">{ageOver14 && <Check size={16} strokeWidth={3} />}</span><span><b>필수</b><strong>만 14세 이상입니다</strong></span>
      </button>
      <button type="button" className={`oauth-consent-row ${agreementComplete ? "checked locked" : ""}`} onClick={() => { if (!agreementComplete) { setTermsRead(false); setModalOpen(true); } }}>
        <span className="oauth-consent-check">{agreementComplete && <Check size={16} strokeWidth={3} />}</span><span><b>필수</b><strong>이용약관 및 개인정보 수집·이용 동의</strong></span><ChevronRight size={19} />
      </button>
    </div>
    {error && <div className="form-error oauth-agreement-error" role="alert">{error} {!profile && <Link href="/login">로그인으로 돌아가기</Link>}</div>}
    <button className="oauth-agreement-submit" type="button" disabled={!ready || pending} onClick={completeSignup}>{pending ? "처리 중..." : "동의하고 시작하기"}</button>
    {modalOpen && <div className="terms-modal-backdrop"><section className="terms-modal" role="dialog" aria-modal="true" aria-labelledby="oauth-terms-title">
      <header><div><small>필수 동의</small><h2 id="oauth-terms-title">이용약관 및 개인정보 동의</h2></div><button type="button" onClick={() => setModalOpen(false)} aria-label="약관 닫기"><X size={23} /></button></header>
      <div className="terms-modal-body" onScroll={(event) => { const target = event.currentTarget; setTermsRead(target.scrollHeight - target.scrollTop - target.clientHeight <= 2); }}><TermsContent social /></div>
      <footer><button type="button" disabled={!termsRead} onClick={() => { setAgreementComplete(true); setModalOpen(false); }}>동의하고 계속하기</button></footer>
    </section></div>}
  </section>;
}
