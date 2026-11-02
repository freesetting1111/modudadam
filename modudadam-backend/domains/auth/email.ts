import nodemailer from "nodemailer";

export type RecoveryPurpose = "find_id" | "password_reset";

function createMailer() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM;
  if (!host || !user || !pass || !from) throw new Error("SMTP_NOT_CONFIGURED");

  const port = Number(process.env.SMTP_PORT || 587);
  return {
    from,
    transporter: nodemailer.createTransport({
      host,
      port,
      secure: process.env.SMTP_SECURE === "true" || port === 465,
      auth: { user, pass },
    }),
  };
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] ?? character);
}

export async function sendRecoveryEmail(to: string, code: string, purpose: RecoveryPurpose) {
  const { from, transporter } = createMailer();
  const title = purpose === "find_id" ? "아이디 찾기" : "비밀번호 찾기";
  await transporter.sendMail({
    from,
    to,
    subject: `[모두다담] ${title} 인증번호`,
    text: `인증번호는 ${code} 입니다. 5분 안에 입력해 주세요.`,
    html: `<div style="font-family:Arial,sans-serif;padding:24px;color:#172033"><h2 style="margin:0 0 20px">모두다담 ${title}</h2><p>아래 인증번호를 5분 안에 입력해 주세요.</p><div style="margin:24px 0;padding:18px;background:#f3f6ff;border-radius:12px;font-size:26px;font-weight:800;letter-spacing:4px;text-align:center">${code}</div><p style="color:#667085;font-size:13px">본인이 요청하지 않았다면 이 메일을 무시해 주세요.</p></div>`,
  });
}

export async function sendWelcomeEmail(to: string, realName: string, loginId: string) {
  const { from, transporter } = createMailer();
  const serviceUrl = process.env.FRONTEND_URL || "http://localhost:3005";
  const safeName = escapeHtml(realName);
  const safeLoginId = escapeHtml(loginId);
  const safeServiceUrl = escapeHtml(serviceUrl);

  await transporter.sendMail({
    from,
    to,
    subject: "[모두다담] 가입을 진심으로 환영합니다",
    text: `${realName}님, 모두다담 가입을 진심으로 축하드립니다.\n\n가입 아이디: ${loginId}\n\n이제 모두다담에서 관심 있는 생활 정보를 둘러보고 이야기를 나눠 보세요.\n${serviceUrl}\n\n본인이 가입하지 않았다면 이 메일에 회신해 주세요.`,
    html: `
      <div style="margin:0;padding:40px 16px;background:#f4f7fc;font-family:Arial,'Apple SD Gothic Neo','Noto Sans KR',sans-serif;color:#172033">
        <div style="max-width:560px;margin:0 auto;overflow:hidden;border:1px solid #e3e9f3;border-radius:20px;background:#ffffff">
          <div style="padding:28px 32px;border-bottom:1px solid #edf1f7;font-size:22px;font-weight:800;color:#172033">모두다담</div>
          <div style="padding:40px 32px">
            <p style="margin:0 0 10px;font-size:14px;font-weight:700;color:#4f73df">회원가입 완료</p>
            <h1 style="margin:0 0 20px;font-size:28px;line-height:1.4;color:#101828">${safeName}님,<br>가입을 진심으로 환영합니다.</h1>
            <p style="margin:0 0 28px;font-size:16px;line-height:1.8;color:#526079">모두다담에서 관심 있는 생활 정보를 둘러보고, 나만의 이야기를 기록하며 다른 사람들과 함께 나눠 보세요.</p>
            <div style="margin:0 0 28px;padding:18px 20px;border-radius:12px;background:#f6f8fc">
              <span style="font-size:13px;color:#7b879b">가입 아이디</span>
              <div style="margin-top:6px;font-size:16px;font-weight:700;color:#172033">${safeLoginId}</div>
            </div>
            <a href="${safeServiceUrl}" style="display:block;padding:15px 20px;border-radius:12px;background:#4f73df;color:#ffffff;font-size:16px;font-weight:700;text-align:center;text-decoration:none">모두다담 둘러보기</a>
          </div>
          <div style="padding:22px 32px;background:#fafbfc;font-size:12px;line-height:1.7;color:#8a94a6">본인이 가입하지 않았다면 이 메일에 회신해 주세요.</div>
        </div>
      </div>
    `,
  });
}
