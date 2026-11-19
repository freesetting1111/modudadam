"use client";

import Image from "next/image";
import { useEffect } from "react";

type AchievementDialogProps = {
  open: boolean;
  eyebrow?: string;
  title: string;
  description: string;
  reward?: string;
  confirmLabel?: string;
  onConfirm: () => void;
};

export function AchievementDialog({
  open,
  eyebrow = "DADAM MOMENT",
  title,
  description,
  reward,
  confirmLabel = "확인",
  onConfirm,
}: AchievementDialogProps) {
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onConfirm();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open, onConfirm]);

  if (!open) return null;

  return <div className="achievement-dialog-backdrop" role="presentation">
    <section className="achievement-dialog" role="alertdialog" aria-modal="true" aria-labelledby="achievement-dialog-title" aria-describedby="achievement-dialog-description">
      <div className="achievement-dialog-effects" aria-hidden="true"><i>✦</i><i>✧</i><i>✦</i><i>✧</i></div>
      <Image src="/brand/modudadam-guide.png" width={210} height={210} alt="축하하는 모두다담 캐릭터" priority />
      <div className="achievement-dialog-copy">
        <small>{eyebrow}</small>
        <h2 id="achievement-dialog-title">{title}</h2>
        <p id="achievement-dialog-description">{description}</p>
        {reward && <strong>{reward}</strong>}
      </div>
      <button type="button" onClick={onConfirm} autoFocus>{confirmLabel}</button>
    </section>
  </div>;
}
