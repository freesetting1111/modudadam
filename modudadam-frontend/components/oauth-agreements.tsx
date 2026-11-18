"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Check, ChevronRight, ShieldCheck, X } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { TermsContent } from "@/components/signup-form";

type PendingProfile = { provider: "naver" | "kakao"; nickname: string | null };
type NicknameState = "unchecked" | "checking" | "available" | "taken";

export function OAuthAgreements({ ticket }: { ticket: string }) {
  const router = useRouter();
  const [profile, setProfile] = useState<PendingProfile | null>(null);
  const [nickname, setNickname] = useState("");
  const [nicknameState, setNicknameState] = useState<NicknameState>("unchecked");
  const [gender, setGender] = useState("");
  const [ageRange, setAgeRange] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [ageOver14, setAgeOver14] = useState(false);
  const [agreementComplete, setAgreementComplete] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [termsRead, setTermsRead] = useState(false);
  const [pending, setPending] = useState(false);
  const [alertMessage, setAlertMessage] = useState("");
  const [error, setError] = useState(ticket ? "" : "가입 인증 정보가 없습니다. 다시 로그인해 주세요.");

  useEffect(() => {
    if (!ticket) return;
    apiRequest<PendingProfile>(`/api/auth/signup/agreements?ticket=${encodeURIComponent(ticket)}`, { cache: "no-store" })
      .then((loaded) => {
        setProfile(loaded);
      })
      .catch((caught) => setError(caught instanceof Error ? caught.message : "가입 정보를 확인하지 못했습니다."));
  }, [ticket]);

  useEffect(() => {
    if (!modalOpen && !alertMessage) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [modalOpen, alertMessage]);

  async function completeSignup() {
    if (!nickname) {
      setAlertMessage("닉네임은 필수값입니다.");
      return;
    }
    if (!isValidNickname(nickname)) {
      setAlertMessage("닉네임 형식을 확인해 주세요.");
      return;
    }
    if (nicknameState !== "available") {
      setAlertMessage("닉네임 중복 확인이 필요합니다.");
      return;
    }
    if (!gender) {
      setAlertMessage("성별을 선택해 주세요.");
      return;
    }
    if (!ageRange) {
      setAlertMessage("연령대를 선택해 주세요.");
      return;
    }
    if (!isValidPhoneNumber(phoneNumber)) {
      setAlertMessage("휴대폰 번호 형식을 확인해 주세요.");
      return;
    }
    if (!ageOver14) {
      setAlertMessage("만 14세 이상 확인은 필수입니다.");
      return;
    }
    if (!agreementComplete) {
      setAlertMessage("이용약관 동의는 필수입니다.");
      return;
    }
    setPending(true); setError("");
    try {
      const result = await apiRequest<{ returnTo: string }>("/api/auth/signup/agreements", {
        method: "POST",
        body: JSON.stringify({ ticket, nickname, gender, ageRange, phoneNumber, ageOver14: true, agreeTerms: true, agreePrivacy: true }),
      });
      router.replace(result.returnTo || "/");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "가입을 완료하지 못했습니다.");
      setPending(false);
    }
  }

  async function checkNickname() {
    if (!isValidNickname(nickname)) return;
    setNicknameState("checking");
    setError("");
    try {
      const result = await apiRequest<{ available: boolean }>(`/api/auth/signup/agreements?ticket=${encodeURIComponent(ticket)}&nickname=${encodeURIComponent(nickname)}`, { cache: "no-store" });
      setNicknameState(result.available ? "available" : "taken");
    } catch (caught) {
      setNicknameState("unchecked");
      setError(caught instanceof Error ? caught.message : "닉네임 중복 여부를 확인하지 못했습니다.");
    }
  }

  const nicknameValid = isValidNickname(nickname);
  return <section className="oauth-agreement-page auth-route-page">
    <div className="oauth-agreement-heading">
      <span><ShieldCheck size={25} /></span>
      <div><small>{profile?.provider === "kakao" ? "카카오" : "네이버"} 계정으로 계속하기</small><h1>시작하기 전에 확인해 주세요</h1><p>커뮤니티 닉네임을 정하고 필수 약관에 동의해 주세요.</p></div>
    </div>
    <div className="oauth-nickname-card">
      <label htmlFor="signup-nickname"><span><b>커뮤니티 닉네임</b><em>{Array.from(nickname).length}/20</em></span></label>
      <div className="oauth-nickname-row">
        <input id="signup-nickname" value={nickname} maxLength={20} placeholder="닉네임을 입력해 주세요" aria-invalid={nickname.length > 0 && (!nicknameValid || nicknameState === "taken")} onChange={(event) => { setNickname(sanitizeNickname(event.target.value)); setNicknameState("unchecked"); setError(""); }} />
        <button type="button" onClick={checkNickname} disabled={!nicknameValid || nicknameState === "checking" || nicknameState === "available"}>{nicknameState === "checking" ? "확인 중" : "중복 확인"}</button>
      </div>
      <p>한글, 영문 소문자, 숫자만 사용해 2~20자로 입력해 주세요.</p>
      {nicknameState === "available" && <small className="oauth-nickname-success"><Check size={14} /> 사용할 수 있는 닉네임입니다.</small>}
      {nicknameState === "taken" && <small className="oauth-nickname-error">이미 사용 중인 닉네임입니다.</small>}
      <div className="oauth-profile-fields">
        <div className="oauth-profile-selects">
          <label><span><b>성별</b><em>필수</em></span><select value={gender} onChange={(event) => setGender(event.target.value)}><option value="">선택해 주세요</option><option value="male">남성</option><option value="female">여성</option></select></label>
          <label><span><b>연령대</b><em>필수</em></span><select value={ageRange} onChange={(event) => setAgeRange(event.target.value)}><option value="">선택해 주세요</option><option value="10-19">10대</option><option value="20-29">20대</option><option value="30-39">30대</option><option value="40-49">40대</option><option value="50-59">50대</option><option value="60+">60대 이상</option></select></label>
        </div>
        <label className="oauth-phone-field" htmlFor="signup-phone"><span><b>휴대폰 번호</b><em>필수 · 직접 입력</em></span><input id="signup-phone" type="tel" inputMode="numeric" autoComplete="tel" value={phoneNumber} maxLength={11} placeholder="01012345678" aria-invalid={phoneNumber.length > 0 && !isValidPhoneNumber(phoneNumber)} onChange={(event) => setPhoneNumber(event.target.value.replace(/\D/g, "").slice(0, 11))} /></label>
        <p>입력한 정보는 다른 사용자에게 공개되지 않으며, 휴대폰 번호는 인증되지 않은 직접 입력 정보입니다.</p>
      </div>
    </div>
    <div className="oauth-agreement-card">
      <button type="button" className={`oauth-consent-row ${ageOver14 ? "checked" : ""}`} onClick={() => setAgeOver14((value) => !value)}>
        <span className="oauth-consent-check">{ageOver14 && <Check size={16} strokeWidth={3} />}</span><span><b>필수</b><strong>만 14세 이상입니다</strong></span>
      </button>
      <button type="button" className={`oauth-consent-row ${agreementComplete ? "checked" : ""}`} onClick={() => { if (agreementComplete) setAgreementComplete(false); else { setTermsRead(false); setModalOpen(true); } }}>
        <span className="oauth-consent-check">{agreementComplete && <Check size={16} strokeWidth={3} />}</span><span><b>필수</b><strong>이용약관 및 개인정보 수집·이용 동의</strong></span><ChevronRight size={19} />
      </button>
    </div>
    {error && <div className="form-error oauth-agreement-error" role="alert">{error} {!profile && <Link href="/login">로그인으로 돌아가기</Link>}</div>}
    <button className="oauth-agreement-submit" type="button" disabled={!profile || pending} onClick={completeSignup}>{pending ? "처리 중..." : "동의하고 시작하기"}</button>
    {modalOpen && <div className="terms-modal-backdrop"><section className="terms-modal" role="dialog" aria-modal="true" aria-labelledby="oauth-terms-title">
      <header><div><small>필수 동의</small><h2 id="oauth-terms-title">이용약관 및 개인정보 동의</h2></div><button type="button" onClick={() => setModalOpen(false)} aria-label="약관 닫기"><X size={23} /></button></header>
      <div className="terms-modal-body" onScroll={(event) => { const target = event.currentTarget; setTermsRead(target.scrollHeight - target.scrollTop - target.clientHeight <= 2); }}><TermsContent social /></div>
      <footer><button type="button" disabled={!termsRead} onClick={() => { setAgreementComplete(true); setModalOpen(false); }}>동의하고 계속하기</button></footer>
    </section></div>}
    {alertMessage && <div className="mascot-alert-backdrop" role="presentation">
      <section className="mascot-alert" role="alertdialog" aria-modal="true" aria-labelledby="oauth-alert-message">
        <div className="mascot-alert-visual" aria-hidden="true"><Image src="/brand/modudadam-login-wave.png" alt="" width={132} height={132} /></div>
        <h2 id="oauth-alert-message">{alertMessage}</h2>
        <button type="button" onClick={() => setAlertMessage("")} autoFocus>확인</button>
      </section>
    </div>}
  </section>;
}

function sanitizeNickname(value: string) {
  return Array.from(value.normalize("NFKC").toLowerCase().replace(/[^가-힣a-z0-9]/gu, "")).slice(0, 20).join("");
}

function isValidNickname(value: string) {
  return /^[가-힣a-z0-9]{2,20}$/u.test(value);
}

function isValidPhoneNumber(value: string) {
  return /^01[016789]\d{7,8}$/.test(value);
}
