"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { Check, ChevronRight, Eye, EyeOff, X } from "lucide-react";
import { apiRequest } from "@/lib/api";

type Values = {
  loginId: string; password: string; passwordConfirm: string; realName: string;
  phoneNumber: string; email: string; agreeTerms: boolean; agreePrivacy: boolean;
};
type Field = keyof Values;
type Errors = Partial<Record<Field, string>>;

const initialValues: Values = {
  loginId: "", password: "", passwordConfirm: "", realName: "",
  phoneNumber: "", email: "", agreeTerms: false, agreePrivacy: false,
};

export function SignupForm({ returnTo }: { returnTo: string }) {
  const router = useRouter();
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState<Errors>({});
  const [serverError, setServerError] = useState("");
  const [pending, setPending] = useState(false);
  const [idChecking, setIdChecking] = useState(false);
  const [checkedLoginId, setCheckedLoginId] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  const [termsRead, setTermsRead] = useState(false);

  useEffect(() => {
    if (!termsOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setTermsOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [termsOpen]);

  const agreementComplete = values.agreeTerms && values.agreePrivacy;

  function update(field: Field, value: string | boolean) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setServerError("");
    if (field === "loginId") setCheckedLoginId("");
  }

  function openTerms() {
    setTermsRead(agreementComplete);
    setTermsOpen(true);
  }

  function acceptTerms() {
    update("agreeTerms", true);
    update("agreePrivacy", true);
    setTermsOpen(false);
  }

  function validateOne(field: Field, nextValues = values) {
    const message = fieldError(field, nextValues);
    setErrors((current) => ({ ...current, [field]: message || undefined }));
    return !message;
  }

  async function checkLoginId() {
    if (!validateOne("loginId")) return;
    setIdChecking(true); setCheckedLoginId("");
    try {
      const data = await apiRequest<{ available: boolean }>(`/api/auth/check-login-id?loginId=${encodeURIComponent(values.loginId)}`);
      if (data.available) setCheckedLoginId(values.loginId);
      else setErrors((current) => ({ ...current, loginId: "이미 사용 중인 아이디입니다." }));
    } catch (caught) {
      setErrors((current) => ({ ...current, loginId: caught instanceof Error ? caught.message : "중복 확인에 실패했습니다." }));
    } finally { setIdChecking(false); }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validateAll(values);
    if (checkedLoginId !== values.loginId && !nextErrors.loginId) nextErrors.loginId = "아이디 중복 확인을 해주세요.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setPending(true); setServerError("");
    try {
      await apiRequest("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({
          loginId: values.loginId, password: values.password, realName: values.realName,
          phoneNumber: values.phoneNumber, email: values.email,
          agreeTerms: values.agreeTerms, agreePrivacy: values.agreePrivacy,
        }),
      });
      const loginUrl = `/login?registered=true&returnTo=${encodeURIComponent(returnTo)}`;
      router.replace(loginUrl);
    } catch (caught) {
      setServerError(caught instanceof Error ? caught.message : "회원가입을 완료하지 못했습니다.");
    } finally { setPending(false); }
  }

  return <form className="account-form signup-form" onSubmit={submit} noValidate>
    <label>아이디<div className="id-check-row"><input name="loginId" value={values.loginId} onChange={(event) => update("loginId", event.target.value.toLowerCase().replace(/[^\x21-\x7E]/g, "").slice(0, 12))} onBlur={() => validateOne("loginId")} autoComplete="username" maxLength={12} placeholder="영문 소문자·숫자·특수문자 4~12자리" aria-invalid={Boolean(errors.loginId)} /><button type="button" onClick={checkLoginId} disabled={values.loginId.length < 4 || idChecking}>{idChecking ? "확인 중" : "중복 확인"}</button></div>{errors.loginId && <small className="field-error" role="alert">{errors.loginId}</small>}{checkedLoginId !== "" && checkedLoginId === values.loginId && <small className="check-success">사용 가능한 아이디입니다.</small>}</label>
    <label>비밀번호<div className="password-input-wrap"><input name="password" value={values.password} onChange={(event) => update("password", event.target.value.replace(/[^\x21-\x7E]/g, "").slice(0, 20))} onBlur={() => validateOne("password")} type={showPassword ? "text" : "password"} autoComplete="new-password" maxLength={20} placeholder="영문·숫자·특수문자 조합 8~20자리" aria-invalid={Boolean(errors.password)} /><button className="password-toggle" type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 보기"} aria-pressed={showPassword}>{showPassword ? <Eye size={21} /> : <EyeOff size={21} />}</button></div>{errors.password && <small className="field-error" role="alert">{errors.password}</small>}</label>
    <label>비밀번호 확인<div className="password-input-wrap"><input name="passwordConfirm" value={values.passwordConfirm} onChange={(event) => update("passwordConfirm", event.target.value.replace(/[^\x21-\x7E]/g, "").slice(0, 20))} onBlur={() => validateOne("passwordConfirm")} type={showPasswordConfirm ? "text" : "password"} autoComplete="new-password" maxLength={20} placeholder="비밀번호를 다시 입력해 주세요." aria-invalid={Boolean(errors.passwordConfirm)} /><button className="password-toggle" type="button" onClick={() => setShowPasswordConfirm((visible) => !visible)} aria-label={showPasswordConfirm ? "비밀번호 확인 숨기기" : "비밀번호 확인 보기"} aria-pressed={showPasswordConfirm}>{showPasswordConfirm ? <Eye size={21} /> : <EyeOff size={21} />}</button></div>{errors.passwordConfirm && <small className="field-error" role="alert">{errors.passwordConfirm}</small>}</label>
    <label>이름<input name="realName" value={values.realName} onChange={(event) => update("realName", event.target.value.replace(/[^ㄱ-ㅎㅏ-ㅣ가-힣A-Za-z]/g, "").slice(0, 30))} onBlur={() => validateOne("realName")} autoComplete="name" maxLength={30} placeholder="한글·영문 2~30자리" aria-invalid={Boolean(errors.realName)} />{errors.realName && <small className="field-error" role="alert">{errors.realName}</small>}</label>
    <label>휴대폰 번호<input name="phoneNumber" value={values.phoneNumber} onChange={(event) => update("phoneNumber", event.target.value.replace(/\D/g, "").slice(0, 11))} onBlur={() => validateOne("phoneNumber")} type="tel" inputMode="numeric" autoComplete="tel" maxLength={11} placeholder="핸드폰번호를 입력해 주세요." aria-invalid={Boolean(errors.phoneNumber)} />{errors.phoneNumber && <small className="field-error" role="alert">{errors.phoneNumber}</small>}</label>
    <label>이메일<input name="email" value={values.email} onChange={(event) => update("email", event.target.value.replace(/[^\x21-\x7E]/g, "").slice(0, 254))} onBlur={() => validateOne("email")} type="email" inputMode="email" autoComplete="email" maxLength={254} placeholder="이메일을 입력해 주세요." aria-invalid={Boolean(errors.email)} />{errors.email && <small className="field-error" role="alert">{errors.email}</small>}</label>
    <button className={`terms-check-row ${agreementComplete ? "checked" : ""}`} type="button" onClick={openTerms} aria-pressed={agreementComplete}>
      <span className="terms-checkbox" aria-hidden="true">{agreementComplete && <Check size={16} strokeWidth={3} />}</span>
      <span className="terms-check-copy"><b>필수</b><strong>이용약관 및 개인정보 수집·이용 동의</strong></span>
      <ChevronRight className="terms-chevron" size={19} aria-hidden="true" />
    </button>
    {errors.agreeTerms && <small className="field-error" role="alert">{errors.agreeTerms}</small>}
    {serverError && <div className="form-error" role="alert">{serverError}</div>}
    <button type="submit" disabled={pending || !agreementComplete}>{pending ? "가입 중..." : agreementComplete ? "회원가입" : "약관 확인 후 회원가입"}</button>
    <div className="auth-links">이미 회원이신가요? <Link href={`/login?returnTo=${encodeURIComponent(returnTo)}`}><b>로그인</b></Link></div>
    {termsOpen && <div className="terms-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setTermsOpen(false); }}>
      <section className="terms-modal" role="dialog" aria-modal="true" aria-labelledby="terms-title">
        <header><div><small>필수 동의</small><h2 id="terms-title">이용약관 및 개인정보 동의</h2></div><button type="button" onClick={() => setTermsOpen(false)} aria-label="약관 닫기"><X size={23} /></button></header>
        <div className="terms-modal-body" onScroll={(event) => { const target = event.currentTarget; const isAtBottom = target.scrollHeight - target.scrollTop - target.clientHeight <= 2; setTermsRead(agreementComplete || isAtBottom); }}>
          <TermsContent />
        </div>
        <footer><button type="button" onClick={agreementComplete ? () => setTermsOpen(false) : acceptTerms} disabled={!termsRead}>{agreementComplete ? "닫기" : "동의하고 계속하기"}</button></footer>
      </section>
    </div>}
  </form>;
}

function TermsContent() {
  return <div className="terms-document">
    <p className="terms-version">시행일: 2026년 10월 30일</p>
    <section><h3>제1조 목적</h3><p>본 약관은 모두다담이 제공하는 생활 정보, 커뮤니티, 게시물 작성 및 기록 관리 서비스의 이용 조건과 절차, 회원과 서비스 운영자의 권리·의무 및 책임사항을 정하는 것을 목적으로 합니다.</p></section>
    <section><h3>제2조 용어의 정의</h3><ol><li>“서비스”란 모두다담이 웹사이트를 통해 제공하는 모든 기능을 말합니다.</li><li>“회원”이란 본 약관에 동의하고 계정을 생성하여 회원 기능을 이용하는 사람을 말합니다.</li><li>“게시물”이란 회원이 서비스에 작성하거나 등록한 글, 댓글, 이미지, 링크 및 기타 정보를 말합니다.</li></ol></section>
    <section><h3>제3조 약관의 효력과 변경</h3><p>본 약관은 회원이 가입 과정에서 내용을 확인하고 동의한 때부터 효력이 발생합니다. 서비스는 관련 법령을 위반하지 않는 범위에서 약관을 변경할 수 있으며, 중요한 변경 사항은 적용일 전에 서비스 화면을 통해 안내합니다.</p></section>
    <section><h3>제4조 회원가입과 계정 관리</h3><ol><li>회원은 정확하고 최신의 정보를 제공해야 합니다.</li><li>아이디와 비밀번호의 관리 책임은 회원에게 있으며 제3자에게 계정을 양도하거나 공유할 수 없습니다.</li><li>타인의 정보를 도용하거나 허위 정보로 가입한 사실이 확인되면 가입이 취소되거나 이용이 제한될 수 있습니다.</li><li>계정의 무단 사용을 알게 된 경우 즉시 비밀번호를 변경하고 서비스에 알려야 합니다.</li></ol></section>
    <section><h3>제5조 서비스의 제공과 변경</h3><p>서비스는 카테고리별 생활 정보 열람, 게시물 및 댓글 작성, 검색, 개인 기록과 그 밖의 관련 기능을 제공합니다. 운영 또는 기술상 필요가 있는 경우 기능의 전부 또는 일부를 변경할 수 있으며, 회원에게 중대한 영향을 주는 변경은 사전에 안내합니다.</p></section>
    <section><h3>제6조 회원의 의무와 금지행위</h3><ol><li>법령, 본 약관 및 서비스 운영정책을 준수해야 합니다.</li><li>타인의 개인정보·저작권·명예 등 권리를 침해해서는 안 됩니다.</li><li>불법 정보, 음란물, 혐오·폭력적 내용, 허위 정보 또는 광고성 도배 게시물을 등록해서는 안 됩니다.</li><li>서비스의 정상 운영을 방해하거나 비정상적인 방법으로 시스템에 접근해서는 안 됩니다.</li><li>수집한 다른 이용자의 정보를 동의 없이 외부에서 이용해서는 안 됩니다.</li></ol></section>
    <section><h3>제7조 게시물의 권리와 관리</h3><p>회원이 작성한 게시물의 권리는 해당 회원에게 있습니다. 회원은 서비스 제공과 화면 노출에 필요한 범위에서 게시물을 이용할 수 있도록 허락합니다. 관련 법령이나 운영정책을 위반한 게시물은 사전 통지 후 숨김·삭제될 수 있으며, 긴급한 권리 침해 또는 법적 의무가 있는 경우 사후 통지할 수 있습니다.</p></section>
    <section><h3>제8조 이용 제한과 계약 해지</h3><p>회원이 약관을 위반하거나 서비스의 안전을 해치는 경우 경고, 게시물 제한, 일시 정지 또는 계정 이용 제한 조치가 이루어질 수 있습니다. 회원은 제공되는 탈퇴 절차를 통해 이용계약을 해지할 수 있습니다.</p></section>
    <section><h3>제9조 서비스 중단과 책임</h3><p>천재지변, 통신 장애, 정기 점검 또는 통제하기 어려운 사유로 서비스가 일시 중단될 수 있습니다. 서비스는 고의 또는 중대한 과실이 없는 한 무료로 제공되는 정보의 정확성이나 회원 간 거래·교류에서 발생한 손해를 보증하지 않습니다.</p></section>
    <section className="terms-major"><h3>개인정보 수집 및 이용 동의</h3><p>모두다담은 회원가입과 회원 서비스 제공을 위해 아래와 같이 개인정보를 수집·이용합니다.</p><div className="privacy-table"><dl><div><dt>수집·이용 목적</dt><dd>가입 의사 확인, 회원 식별, 로그인 및 본인 확인, 계정 복구, 게시물·댓글 등 회원 기능 제공, 부정 이용 방지, 문의 처리 및 중요 공지 전달</dd></div><div><dt>필수 수집 항목</dt><dd>아이디, 비밀번호(단방향 해시 저장), 이름, 휴대폰 번호, 이메일</dd></div><div><dt>자동 수집 항목</dt><dd>접속 IP, 브라우저 및 기기 정보, 접속 경로, 방문 일시, 서비스 이용 기록, 쿠키 또는 익명 식별값</dd></div><div><dt>수집 방법</dt><dd>회원가입 및 서비스 이용 과정에서 회원이 직접 입력하거나 자동 생성·수집</dd></div><div><dt>보유·이용 기간</dt><dd>회원 탈퇴 시까지. 단, 관계 법령에 보존 의무가 있거나 분쟁 처리를 위해 필요한 경우 해당 기간 동안 별도 보관</dd></div></dl></div></section>
    <section><h3>개인정보의 제3자 제공</h3><p>모두다담은 회원의 별도 동의가 있거나 법령에 근거가 있는 경우를 제외하고 개인정보를 제3자에게 제공하지 않습니다. 향후 제3자 제공이 필요한 경우 제공받는 자, 목적, 항목 및 보유기간을 사전에 알리고 별도 동의를 받습니다.</p></section>
    <section><h3>개인정보 처리위탁</h3><p>서비스 운영을 위해 개인정보 처리업무를 외부에 위탁하는 경우 수탁자와 위탁업무의 내용을 공개하고, 수탁자가 개인정보를 안전하게 처리하도록 관리·감독합니다.</p></section>
    <section><h3>개인정보의 파기</h3><p>보유기간이 지나거나 처리 목적이 달성된 개인정보는 복구 또는 재생되지 않도록 지체 없이 파기합니다. 전자적 파일은 복구가 어려운 기술적 방법으로 삭제하고, 출력물은 분쇄 또는 소각 방식으로 파기합니다.</p></section>
    <section><h3>쿠키 및 이용기록</h3><p>로그인 상태 유지, 최근 검색어 저장, 서비스 이용 분석 및 보안 강화를 위해 쿠키 또는 유사 기술을 사용할 수 있습니다. 브라우저 설정에서 쿠키 저장을 거부하거나 삭제할 수 있으나 일부 기능 이용이 제한될 수 있습니다.</p></section>
    <section><h3>정보주체의 권리</h3><p>회원은 자신의 개인정보에 대해 열람, 정정, 삭제, 처리정지 및 동의 철회를 요청할 수 있습니다. 계정 정보 화면이나 서비스 문의 경로를 통해 요청할 수 있으며, 법령에서 정한 사유가 없는 한 필요한 조치를 진행합니다.</p></section>
    <section><h3>안전성 확보 조치</h3><p>비밀번호 단방향 해시 저장, 접근 권한 관리, 접속 기록 관리 및 보안 업데이트 등 개인정보 보호를 위한 기술적·관리적 조치를 적용합니다.</p></section>
    <section><h3>동의 거부 권리 및 불이익</h3><p>개인정보 수집 및 이용 동의를 거부할 권리가 있습니다. 다만 필수 항목 수집에 동의하지 않으면 회원가입, 글·댓글 작성 및 개인 기록 등 회원 전용 기능을 이용할 수 없습니다. 로그인 없이 공개 콘텐츠를 열람하는 기능은 계속 이용할 수 있습니다.</p></section>
    <section><h3>제10조 준거법과 분쟁 해결</h3><p>본 약관은 대한민국 법령을 따릅니다. 서비스 이용과 관련한 분쟁은 당사자 간 성실한 협의를 통해 해결하며, 해결되지 않는 경우 관련 법령이 정한 절차와 관할 법원에 따릅니다.</p></section>
  </div>;
}

function validateAll(values: Values) {
  const errors: Errors = {};
  (Object.keys(values) as Field[]).forEach((field) => {
    const message = fieldError(field, values);
    if (message) errors[field] = message;
  });
  return errors;
}

function fieldError(field: Field, values: Values) {
  const value = values[field];
  if (field === "loginId") return !value ? "아이디를 입력해 주세요." : !/^(?!.*[A-Z])[\x21-\x7E]{4,12}$/.test(String(value)) ? "아이디는 영문 소문자, 숫자, 특수문자로 4~12자리만 입력할 수 있습니다." : "";
  if (field === "password") return !value ? "비밀번호를 입력해 주세요." : !/^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z0-9])[\x21-\x7E]{8,20}$/.test(String(value)) ? "비밀번호는 영문, 숫자, 특수문자를 조합한 8~20자리여야 합니다." : "";
  if (field === "passwordConfirm") return !value ? "비밀번호 확인을 입력해 주세요." : value !== values.password ? "비밀번호가 일치하지 않습니다." : "";
  if (field === "realName") return !value ? "이름을 입력해 주세요." : !/^[가-힣A-Za-z]{2,30}$/.test(String(value)) ? "이름은 공백 없이 한글 또는 영문 2~30자리만 입력할 수 있습니다." : "";
  if (field === "phoneNumber") return !value ? "휴대폰 번호를 입력해 주세요." : !/^01[016789]\d{7,8}$/.test(String(value)) ? "휴대폰 번호 형식을 확인해 주세요." : "";
  if (field === "email") return !value ? "이메일을 입력해 주세요." : !/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$/.test(String(value)) ? "이메일 형식을 확인해 주세요." : "";
  if (field === "agreeTerms") return value ? "" : "이용약관 동의가 필요합니다.";
  return value ? "" : "개인정보 수집 및 이용 동의가 필요합니다.";
}
