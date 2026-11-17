"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { Check, TriangleAlert } from "lucide-react";
import { apiRequest } from "@/lib/api";

const reasons = [
  ["content_lack", "원하는 콘텐츠가 부족해요"],
  ["low_usage", "서비스를 자주 이용하지 않아요"],
  ["privacy_concern", "개인정보가 걱정돼요"],
  ["usability", "서비스 이용이 불편해요"],
  ["other", "기타"],
] as const;

export function WithdrawalForm() {
  const router = useRouter();
  const [acknowledged, setAcknowledged] = useState(false);
  const [reason, setReason] = useState("");
  const [reasonDetail, setReasonDetail] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const ready = acknowledged && Boolean(reason) && (reason !== "other" || Boolean(reasonDetail.trim()));

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!ready) {
      setError(!acknowledged ? "탈퇴 안내를 확인하고 동의해 주세요." : reason === "other" && !reasonDetail.trim() ? "기타 탈퇴 사유를 입력해 주세요." : "탈퇴 사유를 선택해 주세요.");
      return;
    }
    setConfirmOpen(true);
  }

  async function withdraw() {
    setSubmitting(true);
    setError("");
    try {
      await apiRequest("/api/users/me/withdrawal", {
        method: "POST",
        body: JSON.stringify({ acknowledged, reason, reasonDetail: reason === "other" ? reasonDetail.trim() : null }),
      });
      setConfirmOpen(false);
      setCompleted(true);
    } catch (caught) {
      setConfirmOpen(false);
      setError(caught instanceof Error ? caught.message : "회원탈퇴를 처리하지 못했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  function goHome() {
    router.replace("/");
    router.refresh();
  }

  return <>
    <form className="withdrawal-form" onSubmit={submit}>
      <section className="withdrawal-notice">
        <div><TriangleAlert size={19}/><strong>탈퇴 전에 꼭 확인해 주세요.</strong></div>
        <ul>
          <li>탈퇴한 계정과 기존 데이터는 다시 복원할 수 없습니다.</li>
          <li>개인정보와 로그인 연결 정보는 즉시 삭제 또는 익명화됩니다.</li>
          <li>작성한 게시글과 댓글은 탈퇴 후에도 &lsquo;탈퇴한 사용자&rsquo;의 글로 남습니다. 삭제를 원하면 탈퇴 전에 직접 삭제해 주세요.</li>
          <li>같은 소셜 계정이나 아이디로 다시 가입해도 새로운 계정으로 처리됩니다.</li>
        </ul>
      </section>

      <label className={`withdrawal-agreement ${acknowledged ? "checked" : ""}`}><input type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)}/><span><Check size={13}/></span><b>위 안내 사항을 모두 확인했으며, 회원탈퇴에 동의합니다.</b></label>

      <fieldset className="withdrawal-reasons"><legend>탈퇴 사유</legend>
        {reasons.map(([value, label]) => <label key={value}><input type="radio" name="withdrawal-reason" value={value} checked={reason === value} onChange={() => { setReason(value); setError(""); }}/><span/>{label}</label>)}
        {reason === "other" && <label className="withdrawal-other"><span className="sr-only">기타 탈퇴 사유</span><textarea value={reasonDetail} onChange={(event) => setReasonDetail(event.target.value.slice(0, 500))} maxLength={500} rows={3} placeholder="탈퇴 사유를 입력해 주세요." autoFocus/><small>{reasonDetail.length}/500</small></label>}
      </fieldset>

      {error && <div className="form-error" role="alert">{error}</div>}
      <div className="withdrawal-actions"><Link href="/my">취소</Link><button type="submit" disabled={!ready || submitting}>회원탈퇴</button></div>
    </form>

    {confirmOpen && <div className="withdrawal-modal-backdrop" role="presentation"><section className="withdrawal-modal" role="alertdialog" aria-modal="true" aria-labelledby="withdrawal-confirm-title"><TriangleAlert size={27}/><h2 id="withdrawal-confirm-title">정말 탈퇴할까요?</h2><p>탈퇴 후에는 계정과 개인정보를 복구할 수 없습니다.</p><div><button type="button" onClick={() => setConfirmOpen(false)} disabled={submitting}>계속 이용하기</button><button className="danger" type="button" onClick={() => void withdraw()} disabled={submitting}>{submitting ? "처리 중..." : "탈퇴하기"}</button></div></section></div>}

    {completed && <div className="withdrawal-modal-backdrop" role="presentation"><section className="withdrawal-modal complete" role="alertdialog" aria-modal="true" aria-labelledby="withdrawal-complete-title"><span><Check size={24}/></span><h2 id="withdrawal-complete-title">회원탈퇴가 완료되었습니다.</h2><p>그동안 모두다담을 이용해 주셔서 감사합니다.<br/>더 나은 서비스가 되도록 노력하겠습니다.</p><button type="button" onClick={goHome}>홈으로 이동</button></section></div>}
  </>;
}
