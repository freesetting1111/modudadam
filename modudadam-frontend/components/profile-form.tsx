"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { BadgeCheck, Check, LoaderCircle, Mail, Pencil, ShieldCheck, UserRound } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { StampedName } from "@/components/stamped-name";

type Profile = {
  nickname: string;
  statusMessage: string;
  email: string;
  emailVerified: boolean;
  phoneNumber: string;
  gender: string | null;
  ageRange: string | null;
  avatarUrl: string | null;
  stampEmoji: string | null;
  provider: "kakao" | "naver" | "local";
  providerNickname: string | null;
};

type NicknameState = "unchanged" | "unchecked" | "checking" | "available" | "taken";

export function ProfileForm({ initialEditing = false, standalone = false }: { initialEditing?: boolean; standalone?: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState(initialEditing);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [initialNickname, setInitialNickname] = useState("");
  const [nicknameState, setNicknameState] = useState<NicknameState>("unchanged");
  const [loadingError, setLoadingError] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [emailCode, setEmailCode] = useState("");
  const [emailSending, setEmailSending] = useState(false);
  const [emailConfirming, setEmailConfirming] = useState(false);
  const [emailCodeSent, setEmailCodeSent] = useState(false);
  const [emailMessage, setEmailMessage] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    apiRequest<{ profile: Profile }>("/api/users/me/profile", { cache: "no-store", signal: controller.signal })
      .then(({ profile: loaded }) => {
        setProfile(loaded);
        setInitialNickname(loaded.nickname);
        setEmailInput(loaded.email);
      })
      .catch((requestError) => {
        if (requestError instanceof Error && requestError.name !== "AbortError") setLoadingError(requestError.message);
      });
    return () => controller.abort();
  }, []);

  const nicknameValid = useMemo(() => {
    if (!profile) return false;
    return /^[가-힣a-z0-9]{2,20}$/u.test(profile.nickname);
  }, [profile]);
  const nicknameReady = nicknameState === "unchanged" || nicknameState === "available";

  function update<K extends keyof Profile>(key: K, value: Profile[K]) {
    setProfile((current) => current ? { ...current, [key]: value } : current);
    setError("");
    setSuccess("");
    if (key === "nickname") setNicknameState(value === initialNickname ? "unchanged" : "unchecked");
  }

  async function checkNickname() {
    if (!profile || !nicknameValid || nicknameState === "unchanged") return;
    setNicknameState("checking");
    setError("");
    try {
      const result = await apiRequest<{ available: boolean }>(`/api/users/me/nickname-availability?nickname=${encodeURIComponent(profile.nickname)}`);
      setNicknameState(result.available ? "available" : "taken");
    } catch (requestError) {
      setNicknameState("unchecked");
      setError(requestError instanceof Error ? requestError.message : "닉네임을 확인하지 못했습니다.");
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile || !nicknameReady) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const result = await apiRequest<{ profile: Profile }>("/api/users/me/profile", {
        method: "PATCH",
        body: JSON.stringify({
          nickname: profile.nickname,
          statusMessage: profile.statusMessage,
          gender: profile.gender,
          ageRange: profile.ageRange,
          phoneNumber: profile.phoneNumber,
        }),
      });
      setProfile(result.profile);
      setInitialNickname(result.profile.nickname);
      setNicknameState("unchanged");
      setSuccess("프로필을 저장했습니다.");
      if (standalone) router.replace("/my");
      else setEditing(false);
      window.dispatchEvent(new CustomEvent("modudadam:profile-updated", { detail: { nickname: result.profile.nickname } }));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "프로필을 저장하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function requestEmailCode() {
    setEmailSending(true);
    setError("");
    setEmailMessage("");
    try {
      await apiRequest("/api/users/me/email-verification/request", {
        method: "POST",
        body: JSON.stringify({ email: emailInput }),
      });
      setEmailCode("");
      setEmailCodeSent(true);
      setEmailMessage("입력한 이메일로 인증번호를 보냈습니다. 5분 안에 입력해 주세요.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "인증번호를 보내지 못했습니다.");
    } finally {
      setEmailSending(false);
    }
  }

  async function confirmEmailCode() {
    setEmailConfirming(true);
    setError("");
    try {
      const result = await apiRequest<{ profile: Profile }>("/api/users/me/email-verification/confirm", {
        method: "POST",
        body: JSON.stringify({ email: emailInput, code: emailCode }),
      });
      setProfile(result.profile);
      setEmailInput(result.profile.email);
      setEmailCodeSent(false);
      setEmailCode("");
      setEmailMessage("이메일 인증이 완료되었습니다.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "이메일을 인증하지 못했습니다.");
    } finally {
      setEmailConfirming(false);
    }
  }

  if (loadingError) return <div className="profile-state error">{loadingError}</div>;
  if (!profile) return <div className="profile-state"><LoaderCircle className="spin" size={24} /> 프로필을 불러오는 중입니다.</div>;

  if (!editing) return <div className="profile-overview">
    <div className="profile-summary">
      <span className="profile-avatar">
        <Image className={profile.avatarUrl ? undefined : "default-avatar"} src={profile.avatarUrl || "/brand/modudadam-avatar-clean.png"} alt="" width={72} height={72} unoptimized={Boolean(profile.avatarUrl)} />
      </span>
      <div><small>{providerLabel(profile.provider)} 계정</small><strong><StampedName full name={profile.nickname} stamp={profile.stampEmoji} /></strong><p>{profile.statusMessage || "아직 상태 메시지가 없어요."}</p></div>
      <button className="profile-edit-button" type="button" onClick={() => { setEditing(true); setSuccess(""); }}><Pencil size={15} /> 프로필 편집</button>
    </div>
    <section className="profile-section profile-read-section">
      <div className="profile-section-title"><UserRound size={19} /><div><h2>내 정보</h2><p>등록된 계정 정보를 확인할 수 있어요.</p></div></div>
      <dl className="profile-read-grid">
        <div><dt>닉네임</dt><dd><StampedName full name={profile.nickname} stamp={profile.stampEmoji} /></dd></div>
        <div><dt>상태 메시지</dt><dd>{profile.statusMessage || "미등록"}</dd></div>
        <div><dt>성별</dt><dd>{genderLabel(profile.gender)}</dd></div>
        <div><dt>연령대</dt><dd>{ageRangeLabel(profile.ageRange)}</dd></div>
        <div className="wide"><dt>휴대폰 번호</dt><dd>{formatPhoneNumber(profile.phoneNumber) || "미등록"} <small>직접 입력 · 미인증</small></dd></div>
        <div className="wide"><dt>이메일</dt><dd>{profile.email || "미등록"}{profile.emailVerified && <span><BadgeCheck size={14} /> 인증 완료</span>}</dd></div>
      </dl>
    </section>
    {success && <div className="profile-save-success" role="status"><Check size={16} /> {success}</div>}
  </div>;

  return <form className="profile-form" onSubmit={submit}>
    <div className="profile-summary">
      <span className="profile-avatar">
        <Image className={profile.avatarUrl ? undefined : "default-avatar"} src={profile.avatarUrl || "/brand/modudadam-avatar-clean.png"} alt="" width={72} height={72} unoptimized={Boolean(profile.avatarUrl)} />
      </span>
      <div><small>{providerLabel(profile.provider)} 계정</small><strong><StampedName full name={profile.nickname} stamp={profile.stampEmoji} /></strong><p>모두다담에서 사용할 프로필을 관리해요.</p></div>
    </div>

    <section className="profile-section">
      <div className="profile-section-title"><UserRound size={19} /><div><h2>커뮤니티 프로필</h2><p>게시글과 댓글에 표시되는 정보예요.</p></div></div>
      <label className="profile-field">
        <span><b>닉네임</b><em>{Array.from(profile.nickname).length}/20</em></span>
        <div className="profile-nickname-row">
          <input value={profile.nickname} onChange={(event) => update("nickname", Array.from(event.target.value.normalize("NFKC").toLowerCase().replace(/[^가-힣a-z0-9]/gu, "")).slice(0, 20).join(""))} maxLength={20} placeholder="닉네임을 입력해 주세요." aria-invalid={!nicknameValid || nicknameState === "taken"} />
          <button type="button" onClick={checkNickname} disabled={!nicknameValid || nicknameState === "unchanged" || nicknameState === "checking" || nicknameState === "available"}>{nicknameState === "checking" ? "확인 중" : "중복 확인"}</button>
        </div>
        {!nicknameValid && <small className="profile-error">한글, 영문 소문자, 숫자로 2~20자리까지 입력해 주세요.</small>}
        {nicknameState === "available" && <small className="profile-success"><Check size={13} /> 사용할 수 있는 닉네임입니다.</small>}
        {nicknameState === "taken" && <small className="profile-error">이미 사용 중인 닉네임입니다.</small>}
      </label>
      <label className="profile-field">
        <span><b>상태 메시지</b><em>{profile.statusMessage.length}/30</em></span>
        <input value={profile.statusMessage} onChange={(event) => update("statusMessage", event.target.value.slice(0, 30))} maxLength={30} placeholder="나를 소개하는 짧은 문장을 입력해 주세요." />
      </label>
    </section>

    <section className="profile-section">
      <div className="profile-section-title"><ShieldCheck size={19} /><div><h2>기본 정보</h2><p>계정과 서비스 이용에 필요한 정보예요.</p></div></div>
      <div className="profile-select-grid">
        <label><span>성별 <em>선택</em></span><select value={profile.gender || ""} onChange={(event) => update("gender", event.target.value || null)}><option value="">선택 안 함</option><option value="male">남성</option><option value="female">여성</option><option value="other">기타</option></select></label>
        <label><span>연령대 <em>선택</em></span><select value={profile.ageRange || ""} onChange={(event) => update("ageRange", event.target.value || null)}><option value="">선택 안 함</option><option value="10-19">10대</option><option value="20-29">20대</option><option value="30-39">30대</option><option value="40-49">40대</option><option value="50-59">50대</option><option value="60+">60대 이상</option></select></label>
      </div>
      <label className="profile-field">
        <span><b>휴대폰 번호</b><em>필수 · 직접 입력</em></span>
        <input type="tel" inputMode="numeric" autoComplete="tel" value={profile.phoneNumber} onChange={(event) => update("phoneNumber", event.target.value.replace(/\D/g, "").slice(0, 11))} maxLength={11} placeholder="01012345678" aria-invalid={!isValidPhoneNumber(profile.phoneNumber)} />
        {!isValidPhoneNumber(profile.phoneNumber) && <small className="profile-error">휴대폰 번호 형식을 확인해 주세요.</small>}
      </label>
      <p className="profile-source-note"><BadgeCheck size={15} /> 직접 선택하는 선택 정보이며 다른 사용자에게 공개되지 않아요.</p>
      <div className="profile-field">
        <span><b><Mail size={15} /> 이메일</b>{profile.emailVerified && emailInput === profile.email ? <small className="profile-verified"><BadgeCheck size={14} /> 인증 완료</small> : <em>선택</em>}</span>
        <div className="profile-email-row">
          <input type="email" value={emailInput} onChange={(event) => { setEmailInput(event.target.value.replace(/[^\x21-\x7E]/g, "").slice(0, 254)); setEmailCodeSent(false); setEmailMessage(""); }} maxLength={254} placeholder="name@example.com" inputMode="email" />
          <button type="button" onClick={requestEmailCode} disabled={emailSending || !emailInput || (profile.emailVerified && emailInput === profile.email)}>{emailSending ? "발송 중" : profile.emailVerified && emailInput === profile.email ? "인증 완료" : "인증번호 받기"}</button>
        </div>
        {emailCodeSent && <div className="profile-email-row"><input value={emailCode} onChange={(event) => setEmailCode(event.target.value.replace(/\D/g, "").slice(0, 6))} maxLength={6} placeholder="6자리 인증번호" inputMode="numeric" /><button type="button" onClick={confirmEmailCode} disabled={emailConfirming || emailCode.length !== 6}>{emailConfirming ? "확인 중" : "확인"}</button></div>}
        {emailMessage && <small className={profile.emailVerified && emailInput === profile.email ? "profile-success" : "profile-help"}>{profile.emailVerified && emailInput === profile.email && <Check size={13} />}{emailMessage}</small>}
      </div>
      <p className="profile-verification-note">이메일은 인증 후 저장됩니다. 휴대폰 번호는 직접 입력한 미인증 정보이며 다른 사용자에게 공개되지 않아요.</p>
    </section>

    {error && <div className="form-error" role="alert">{error}</div>}
    {success && <div className="profile-save-success" role="status"><Check size={16} /> {success}</div>}
    <div className="profile-edit-actions"><button type="button" onClick={() => standalone ? router.push("/my") : setEditing(false)} disabled={saving}>취소</button><button className="profile-submit" type="submit" disabled={saving || !nicknameValid || !nicknameReady || !isValidPhoneNumber(profile.phoneNumber)}>{saving ? "저장 중..." : nicknameState === "unchecked" || nicknameState === "taken" ? "닉네임 중복 확인이 필요합니다" : "저장하기"}</button></div>
  </form>;
}

function providerLabel(provider: Profile["provider"]) {
  if (provider === "kakao") return "카카오";
  if (provider === "naver") return "네이버";
  return "모두다담";
}

function genderLabel(value: string | null) {
  if (value === "male") return "남성";
  if (value === "female") return "여성";
  if (value === "other") return "기타";
  return "미등록";
}

function ageRangeLabel(value: string | null) {
  if (!value) return "미등록";
  if (value === "60+") return "60대 이상";
  return `${value.slice(0, 2)}대`;
}

function isValidPhoneNumber(value: string) {
  return /^01[016789]\d{7,8}$/.test(value);
}

function formatPhoneNumber(value: string) {
  if (value.length === 11) return value.replace(/(\d{3})(\d{4})(\d{4})/, "$1-$2-$3");
  if (value.length === 10) return value.replace(/(\d{3})(\d{3})(\d{4})/, "$1-$2-$3");
  return value;
}
