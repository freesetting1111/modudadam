import nodemailer from "nodemailer";

export type RecoveryPurpose = "find_id" | "password_reset";

export async function sendRecoveryEmail(to: string, code: string, purpose: RecoveryPurpose) {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM;
  if (!host || !user || !pass || !from) throw new Error("SMTP_NOT_CONFIGURED");

  const port = Number(process.env.SMTP_PORT || 587);
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: process.env.SMTP_SECURE === "true" || port === 465,
    auth: { user, pass },
  });
  const title = purpose === "find_id" ? "아이디 찾기" : "비밀번호 찾기";
  await transporter.sendMail({
    from,
    to,
    subject: `[모두다담] ${title} 인증번호`,
    text: `인증번호는 ${code} 입니다. 5분 안에 입력해 주세요.`,
    html: `<div style="font-family:Arial,sans-serif;padding:24px;color:#172033"><h2 style="margin:0 0 20px">모두다담 ${title}</h2><p>아래 인증번호를 5분 안에 입력해 주세요.</p><div style="margin:24px 0;padding:18px;background:#f3f6ff;border-radius:12px;font-size:26px;font-weight:800;letter-spacing:4px;text-align:center">${code}</div><p style="color:#667085;font-size:13px">본인이 요청하지 않았다면 이 메일을 무시해 주세요.</p></div>`,
  });
}
