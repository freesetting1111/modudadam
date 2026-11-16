type LoginFormProps = {
  returnTo: string;
  oauthError?: string;
  provider?: string;
};

export function LoginForm({ returnTo, oauthError, provider }: LoginFormProps) {
  const query = `?returnTo=${encodeURIComponent(returnTo)}`;
  const providerName = provider === "naver" ? "네이버" : provider === "kakao" ? "카카오" : "소셜";

  return <div className="login-v2-panel">
    {oauthError && <div className="login-v2-error" role="alert">
      {providerName} 로그인을 완료하지 못했어요. 잠시 후 다시 시도해 주세요.
    </div>}
    <div className="login-v2-providers">
      <a className="login-v2-provider" href={`/api/auth/oauth/kakao/start${query}`} aria-label="카카오로 가입 또는 로그인">
        <span className="login-v2-icon login-v2-kakao" aria-hidden="true"><svg width="30" height="30" viewBox="0 0 64 64" focusable="false"><path d="M32 10C17.64 10 6 19.25 6 30.66c0 7.34 4.83 13.79 12.1 17.46l-3.08 11.3c-.27 1 .87 1.8 1.74 1.23l13.5-8.94c.58.04 1.16.06 1.74.06 14.36 0 26-9.25 26-20.66S46.36 10 32 10Z" /></svg></span>
        <strong>카카오</strong>
      </a>
      <a className="login-v2-provider" href={`/api/auth/oauth/naver/start${query}`} aria-label="네이버로 가입 또는 로그인">
        <span className="login-v2-icon login-v2-naver" aria-hidden="true">N</span>
        <strong>네이버</strong>
      </a>
    </div>
    <p className="login-v2-note">가입과 로그인이 한 번에 진행돼요</p>
  </div>;
}
