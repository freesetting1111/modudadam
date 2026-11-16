"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { BadgeCheck, Check, LoaderCircle, Mail, Phone, ShieldCheck, UserRound } from "lucide-react";
import { apiRequest } from "@/lib/api";

type Profile = {
  nickname: string;
  statusMessage: string;
  email: string;
  phoneNumber: string;
  gender: string | null;
  ageRange: string | null;
  avatarUrl: string | null;
  provider: "kakao" | "naver" | "local";
  providerNickname: string | null;
};

type NicknameState = "unchanged" | "unchecked" | "checking" | "available" | "taken";

export function ProfileForm() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [initialNickname, setInitialNickname] = useState("");
  const [nicknameState, setNicknameState] = useState<NicknameState>("unchanged");
  const [loadingError, setLoadingError] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    apiRequest<{ profile: Profile }>("/api/users/me/profile", { cache: "no-store", signal: controller.signal })
      .then(({ profile: loaded }) => {
        setProfile(loaded);
        setInitialNickname(loaded.nickname);
      })
      .catch((requestError) => {
        if (requestError instanceof Error && requestError.name !== "AbortError") setLoadingError(requestError.message);
      });
    return () => controller.abort();
  }, []);

  const nicknameValid = useMemo(() => {
    if (!profile) return false;
    return /^[^\s\u0000-\u001f\u007f]{2,12}$/u.test(profile.nickname);
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
          email: profile.email,
          phoneNumber: profile.phoneNumber,
        }),
      });
      setProfile(result.profile);
      setInitialNickname(result.profile.nickname);
      setNicknameState("unchanged");
      setSuccess("프로필을 저장했습니다.");
      window.dispatchEvent(new CustomEvent("modudadam:profile-updated", { detail: { nickname: result.profile.nickname } }));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "프로필을 저장하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  }

  if (loadingError) return <div className="profile-state error">{loadingError}</div>;
  if (!profile) return <div className="profile-state"><LoaderCircle className="spin" size={24} /> 프로필을 불러오는 중입니다.</div>;

  return <form className="profile-form" onSubmit={submit}>
    <div className="profile-summary">
      <span className="profile-avatar">
        <Image src={profile.avatarUrl || "/brand/modudadam-squirrel.png"} alt="" width={72} height={72} unoptimized={Boolean(profile.avatarUrl)} />
      </span>
      <div><small>{providerLabel(profile.provider)} 계정</small><strong>{profile.nickname}</strong><p>모두다담에서 사용할 프로필을 관리해요.</p></div>
    </div>

    <section className="profile-section">
      <div className="profile-section-title"><UserRound size={19} /><div><h2>커뮤니티 프로필</h2><p>게시글과 댓글에 표시되는 정보예요.</p></div></div>
      <label className="profile-field">
        <span><b>닉네임</b><em>{Array.from(profile.nickname).length}/12</em></span>
        <div className="profile-nickname-row">
          <input value={profile.nickname} onChange={(event) => update("nickname", Array.from(event.target.value.replace(/\s/g, "")).slice(0, 12).join(""))} maxLength={12} placeholder="닉네임을 입력해 주세요." aria-invalid={!nicknameValid || nicknameState === "taken"} />
          <button type="button" onClick={checkNickname} disabled={!nicknameValid || nicknameState === "unchanged" || nicknameState === "checking" || nicknameState === "available"}>{nicknameState === "checking" ? "확인 중" : "중복 확인"}</button>
        </div>
        {!nicknameValid && <small className="profile-error">공백 없이 2~12자리로 입력해 주세요.</small>}
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
      <div className="profile-readonly-grid">
        <div><span>성별</span><strong>{genderLabel(profile.gender)}</strong></div>
        <div><span>연령대</span><strong>{ageLabel(profile.ageRange)}</strong></div>
      </div>
      <p className="profile-source-note"><BadgeCheck size={15} /> 성별과 연령대는 연결된 소셜 계정에서 제공된 정보이며 공개되지 않아요.</p>
      <label className="profile-field">
        <span><b><Mail size={15} /> 이메일</b><em>{profile.email.length}/254</em></span>
        <input type="email" value={profile.email} onChange={(event) => update("email", event.target.value.replace(/[^\x21-\x7E]/g, "").slice(0, 254))} maxLength={254} placeholder="name@example.com" inputMode="email" />
      </label>
      <label className="profile-field">
        <span><b><Phone size={15} /> 휴대폰 번호</b><em>{profile.phoneNumber.length}/11</em></span>
        <input value={profile.phoneNumber} onChange={(event) => update("phoneNumber", event.target.value.replace(/\D/g, "").slice(0, 11))} maxLength={11} placeholder="숫자만 입력해 주세요." inputMode="numeric" />
      </label>
      <p className="profile-verification-note">이메일이나 휴대폰 번호를 변경하면 기존 인증 상태가 해제됩니다.</p>
    </section>

    {error && <div className="form-error" role="alert">{error}</div>}
    {success && <div className="profile-save-success" role="status"><Check size={16} /> {success}</div>}
    <button className="profile-submit" type="submit" disabled={saving || !nicknameValid || !nicknameReady}>{saving ? "저장 중..." : nicknameState === "unchecked" || nicknameState === "taken" ? "닉네임 중복 확인이 필요합니다" : "저장하기"}</button>
  </form>;
}

function providerLabel(provider: Profile["provider"]) {
  if (provider === "kakao") return "카카오";
  if (provider === "naver") return "네이버";
  return "모두다담";
}

function genderLabel(gender: string | null) {
  if (!gender) return "미제공";
  const value = gender.toLowerCase();
  if (value === "m" || value === "male") return "남성";
  if (value === "f" || value === "female") return "여성";
  return "미제공";
}

function ageLabel(ageRange: string | null) {
  if (!ageRange) return "미제공";
  const firstAge = ageRange.match(/\d{2}/)?.[0];
  return firstAge ? `${firstAge}대` : ageRange;
}
