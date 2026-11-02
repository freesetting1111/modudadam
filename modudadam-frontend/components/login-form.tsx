"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { apiRequest } from "@/lib/api";

export function LoginForm({ returnTo, oauthError, registered = false }: { returnTo: string; oauthError?: string; registered?: boolean }) {
  const router = useRouter();
  const [error, setError] = useState(oauthError ? "소셜 로그인을 완료하지 못했어요. 다시 시도해 주세요." : "");
  const [pending, setPending] = useState(false);
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      await apiRequest("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ loginId, password }),
      });
      router.replace(returnTo);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "로그인하지 못했습니다.");
    } finally {
      setPending(false);
    }
  }

  return <>
    <form className="login-form-card" onSubmit={submit}>
      {registered && <div className="login-form-success" role="status">회원가입이 완료되었습니다. 가입한 아이디와 비밀번호로 로그인해 주세요.</div>}
      <label className="login-field" htmlFor="login-id"><span>아이디</span><input className="login-input" id="login-id" name="loginId" value={loginId} onChange={(event) => setLoginId(event.target.value.toLowerCase().replace(/[^\x21-\x7E]/g, "").slice(0, 12))} autoComplete="username" maxLength={12} required placeholder="아이디를 입력해 주세요" /></label>
      <label className="login-field" htmlFor="login-password"><span>비밀번호</span><input className="login-input" id="login-password" name="password" value={password} onChange={(event) => setPassword(event.target.value.replace(/[^\x21-\x7E]/g, "").slice(0, 20))} type="password" autoComplete="current-password" maxLength={20} required placeholder="비밀번호를 입력해 주세요" /></label>
      {error && <div className="login-form-error" role="alert">{error}</div>}
      <button className="login-submit" type="submit" disabled={pending}>{pending ? "로그인 중..." : "로그인"}</button>
    </form>
    <div className="login-account-links"><Link href="/account/find-id">아이디 찾기</Link><span>·</span><Link href="/account/reset-password">비밀번호 찾기</Link><span>·</span><Link href={`/signup?returnTo=${encodeURIComponent(returnTo)}`}>회원가입</Link></div>
    {/* 도메인과 OAuth 설정을 마친 뒤 다시 노출합니다.
    <div className="auth-divider"><span>소셜 로그인</span></div>
    <div className="login-buttons">
      <a className="kakao" href="http://localhost:3004/api/auth/oauth/kakao/start">카카오로 계속하기</a>
      <a className="naver" href="http://localhost:3004/api/auth/oauth/naver/start">네이버로 계속하기</a>
    </div>
    */}
  </>;
}
