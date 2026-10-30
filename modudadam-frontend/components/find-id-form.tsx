"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { apiRequest } from "@/lib/api";

export function FindIdForm() {
  const [email, setEmail] = useState("");
  const [requested, setRequested] = useState(false);
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function requestCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const nextEmail = String(form.get("email") || "");
    setPending(true); setError("");
    try {
      await apiRequest("/api/auth/recovery/find-id/request", { method: "POST", body: JSON.stringify({ realName: form.get("realName"), email: nextEmail }) });
      setEmail(nextEmail); setRequested(true);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "인증번호를 발송하지 못했습니다."); }
    finally { setPending(false); }
  }

  async function confirmCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true); setError("");
    try {
      const data = await apiRequest<{ maskedLoginId: string }>("/api/auth/recovery/find-id/confirm", { method: "POST", body: JSON.stringify({ email, code: form.get("code") }) });
      setResult(data.maskedLoginId);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "인증번호를 확인하지 못했습니다."); }
    finally { setPending(false); }
  }

  if (result) return <><div className="login-form-card recovery-complete"><span>아이디</span><strong className="recovered-id">{result}</strong><Link className="login-submit recovery-login-button" href="/login">로그인</Link></div></>;

  return <>
    {!requested ? <form className="login-form-card recovery-form" onSubmit={requestCode}>
      <label className="login-field" htmlFor="find-name"><span>이름</span><input className="login-input" id="find-name" name="realName" autoComplete="name" required /></label>
      <label className="login-field" htmlFor="find-email"><span>이메일</span><input className="login-input" id="find-email" name="email" type="email" autoComplete="email" required /></label>
      {error && <div className="login-form-error" role="alert">{error}</div>}
      <button className="login-submit" type="submit" disabled={pending}>{pending ? "발송 중..." : "인증번호 받기"}</button>
    </form> : <form className="login-form-card recovery-form" onSubmit={confirmCode}>
      <label className="login-field" htmlFor="find-code"><span>인증번호</span><input className="login-input" id="find-code" name="code" autoCapitalize="none" maxLength={8} required /></label>
      {error && <div className="login-form-error" role="alert">{error}</div>}
      <button className="login-submit" type="submit" disabled={pending}>{pending ? "확인 중..." : "인증하기"}</button>
    </form>}
    <div className="login-signup-link"><Link href="/login">로그인</Link></div>
  </>;
}
