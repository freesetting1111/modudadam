import type { Metadata } from "next";
import { Geist_Mono, Noto_Sans_KR } from "next/font/google";
import { SiteHeader } from "@/components/site-header";
import { BottomNav } from "@/components/bottom-nav";
import { AnalyticsTracker } from "@/components/analytics-tracker";
import "./globals.css";

const notoSansKr = Noto_Sans_KR({ variable: "--font-noto-sans-kr", weight: "variable", preload: false, display: "swap" });

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "모두다담",
    template: "%s | 모두다담",
  },
  description: "모두의 이야기를 한곳에 담는 서비스",
};

export const viewport = { width: "device-width", initialScale: 1, maximumScale: 1 };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className={`${notoSansKr.variable} ${geistMono.variable}`}>
      <body className="antialiased" suppressHydrationWarning>
        <div className="app-shell">
          <AnalyticsTracker />
          <SiteHeader />
          <main>{children}</main>
          <footer>© 모두다담 · 일상을 다정하게 담아요</footer>
          <BottomNav />
        </div>
      </body>
    </html>
  );
}
