"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { apiRequest } from "@/lib/api";

export function ResetPasswordForm() {
  const [loginId, setLoginId] = useState("");
  const [email, setEmail] = useState("");
  const [requested, setRequested] = useState(false);
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function requestCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const nextLoginId = String(form.get("loginId") || "");
    const nextEmail = String(form.get("email") || "");
    setPending(true); setError("");
    try {
      await apiRequest("/api/auth/recovery/password/request", { method: "POST", body: JSON.stringify({ loginId: nextLoginId, email: nextEmail }) });
      setLoginId(nextLoginId); setEmail(nextEmail); setRequested(true);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "인증번호를 발송하지 못했습니다."); }
    finally { setPending(false); }
  }

  async function confirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (form.get("newPassword") !== form.get("passwordConfirm")) { setError("비밀번호 확인이 일치하지 않습니다."); return; }
    setPending(true); setError("");
    try {
      await apiRequest("/api/auth/recovery/password/confirm", { method: "POST", body: JSON.stringify({ loginId, email, code: form.get("code"), newPassword: form.get("newPassword") }) });
      setComplete(true);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "비밀번호를 변경하지 못했습니다."); }
    finally { setPending(false); }
  }

  if (complete) return <div className="login-form-card recovery-complete"><strong>비밀번호가 변경되었습니다.</strong><Link className="login-submit recovery-login-button" href="/login">로그인</Link></div>;

  if (!requested) return <form className="login-form-card recovery-form" onSubmit={requestCode}>
    <label className="login-field" htmlFor="reset-id"><span>아이디</span><input className="login-input" id="reset-id" name="loginId" autoComplete="username" required /></label>
    <label className="login-field" htmlFor="reset-email"><span>이메일</span><input className="login-input" id="reset-email" name="email" type="email" autoComplete="email" required /></label>
    {error && <div className="login-form-error" role="alert">{error}</div>}
    <button className="login-submit" type="submit" disabled={pending}>{pending ? "발송 중..." : "인증번호 받기"}</button>
  </form>;

  return <form className="login-form-card recovery-form" onSubmit={confirm}>
    <label className="login-field" htmlFor="reset-code"><span>인증번호</span><input className="login-input" id="reset-code" name="code" autoCapitalize="none" maxLength={8} required /></label>
    <label className="login-field" htmlFor="new-password"><span>새 비밀번호</span><input className="login-input" id="new-password" name="newPassword" type="password" autoComplete="new-password" minLength={8} maxLength={20} pattern="(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z0-9])[\x21-\x7E]{8,20}" onInput={(event) => { event.currentTarget.value = event.currentTarget.value.replace(/[^\x21-\x7E]/g, "").slice(0, 20); }} placeholder="영문·숫자·특수문자 조합 8~20자리" required /></label>
    <label className="login-field" htmlFor="new-password-confirm"><span>새 비밀번호 확인</span><input className="login-input" id="new-password-confirm" name="passwordConfirm" type="password" autoComplete="new-password" minLength={8} maxLength={20} onInput={(event) => { event.currentTarget.value = event.currentTarget.value.replace(/[^\x21-\x7E]/g, "").slice(0, 20); }} required /></label>
    {error && <div className="login-form-error" role="alert">{error}</div>}
    <button className="login-submit" type="submit" disabled={pending}>{pending ? "변경 중..." : "비밀번호 변경"}</button>
  </form>;
}
