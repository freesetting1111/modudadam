import type { Metadata } from "next";
import Script from "next/script";
import { Geist_Mono, Noto_Sans_KR } from "next/font/google";
import { SiteHeader } from "@/components/site-header";
import { BottomNav } from "@/components/bottom-nav";
import { AnalyticsTracker } from "@/components/analytics-tracker";
import { getServerSessionUser } from "@/lib/auth";
import { getSiteUrl } from "@/lib/site-url";
import "./globals.css";
import "./community.css";
import "./features.css";

const notoSansKr = Noto_Sans_KR({ variable: "--font-noto-sans-kr", weight: "variable", preload: false, display: "swap" });

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const verificationOther: Record<string, string> = {};

if (process.env.NAVER_SITE_VERIFICATION) {
  verificationOther["naver-site-verification"] = process.env.NAVER_SITE_VERIFICATION;
}

if (process.env.BING_SITE_VERIFICATION) {
  verificationOther["msvalidate.01"] = process.env.BING_SITE_VERIFICATION;
}

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: "모두다담",
    template: "%s | 모두다담",
  },
  description: "모두의 이야기를 한곳에 담는 서비스",
  alternates: { canonical: "/" },
  openGraph: { type: "website", locale: "ko_KR", siteName: "모두다담", title: "모두다담", description: "모두의 이야기를 한곳에 담는 서비스", url: "/", images: ["/brand/modudadam-brand-mark.png"] },
  ...(Object.keys(verificationOther).length
    ? { verification: { other: verificationOther } }
    : {}),
};

export const viewport = { width: "device-width", initialScale: 1, maximumScale: 1 };

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const sessionUser = await getServerSessionUser();
  const gaId = process.env.NEXT_PUBLIC_GA_ID?.trim();
  return (
    <html lang="ko" className={`${notoSansKr.variable} ${geistMono.variable}`}>
      <body className="antialiased" suppressHydrationWarning>
        <div className="app-shell">
          <AnalyticsTracker />
          <SiteHeader initialUser={sessionUser} />
          <main>{children}</main>
          <footer>© 모두다담 · 일상을 다정하게 담아요</footer>
          <BottomNav authenticated={Boolean(sessionUser)} />
        </div>
        {gaId ? (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gaId)}`}
              strategy="afterInteractive"
            />
            <Script id="google-analytics" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', ${JSON.stringify(gaId)});
              `}
            </Script>
          </>
        ) : null}
      </body>
    </html>
  );
}
