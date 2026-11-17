import type { Metadata } from "next";
import { Noto_Sans_KR } from "next/font/google";
import "./globals.css";

const notoSansKr = Noto_Sans_KR({ variable: "--font-noto-sans-kr", weight: "variable", preload: false, display: "swap" });
export const metadata: Metadata = {
  title: { default: "모두다담 이벤트", template: "%s | 모두다담 이벤트" },
  description: "모두다담의 참여형 이벤트를 만나는 별도 이벤트 공간입니다.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return <html lang="ko" className={notoSansKr.variable}><body>{children}</body></html>;
}
