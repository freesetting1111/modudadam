"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { getAnonymousId } from "@/lib/anonymous-id";

const ATTRIBUTION_KEY = "modudadam_traffic_attribution";
const SESSION_ID_KEY = "modudadam_analytics_session_id";

type TrafficAttribution = {
  referrer: string | null;
  landingUrl: string;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  utmTerm: string | null;
  gclid: string | null;
  fbclid: string | null;
};

export function AnalyticsTracker({ backendUrl }: { backendUrl: string }) {
  const pathname = usePathname();
  const directBackendUrl = backendUrl.replace(/\/+$/, "");
  const lastLoggedPath = useRef<string | null>(null);
  useEffect(() => {
    if (lastLoggedPath.current === pathname) return;
    lastLoggedPath.current = pathname;
    const anonymousId = getAnonymousId();
    const query = new URLSearchParams(window.location.search);
    const attribution = getTrafficAttribution(query);
    void fetch("/api/access-logs", {
      method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        eventName: "page_view", anonymousId, sessionId: getAnalyticsSessionId(), path: pathname,
        queryString: window.location.search, pageTitle: document.title,
        referrer: attribution.referrer, landingUrl: attribution.landingUrl,
        utmSource: attribution.utmSource, utmMedium: attribution.utmMedium,
        utmCampaign: attribution.utmCampaign, utmContent: attribution.utmContent,
        utmTerm: attribution.utmTerm, gclid: attribution.gclid, fbclid: attribution.fbclid,
        deviceType: window.innerWidth < 768 ? "mobile" : "desktop",
        viewportWidth: window.innerWidth, viewportHeight: window.innerHeight,
        locale: navigator.language, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        occurredAt: new Date().toISOString(),
      }),
    }).catch(() => undefined);
  }, [pathname]);
  useEffect(() => {
    const anonymousId = getAnonymousId();
    let active = true;
    async function heartbeat() {
      if (document.visibilityState === "hidden") return;
      const requestBody = JSON.stringify({ anonymousId, path: window.location.pathname });
      let payload: { success?: boolean; data?: { visitorCount?: number } } | null = null;
      try {
        const proxyResponse = await fetch("/api/visitors/presence", {
          method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
          body: requestBody,
        });
        payload = await proxyResponse.json() as { success?: boolean; data?: { visitorCount?: number } };
      } catch { /* 직접 요청은 계속 시도합니다. */ }
      if (directBackendUrl && !isSameOrigin(directBackendUrl)) {
        try {
          const directResponse = await fetch(`${directBackendUrl}/api/visitors/presence`, {
            method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
            body: requestBody,
          });
          payload = await directResponse.json() as { success?: boolean; data?: { visitorCount?: number } };
        } catch { /* 방문자 표시는 서비스 이용을 방해하지 않습니다. */ }
      }
      if (active && payload?.success && typeof payload.data?.visitorCount === "number") {
        window.dispatchEvent(new CustomEvent("modudadam:visitor-count", { detail: { visitorCount: payload.data.visitorCount } }));
      }
    }
    void heartbeat();
    const interval = window.setInterval(() => void heartbeat(), 60_000);
    const handleFocus = () => void heartbeat();
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleFocus);
    return () => { active = false; window.clearInterval(interval); window.removeEventListener("focus", handleFocus); document.removeEventListener("visibilitychange", handleFocus); };
  }, [directBackendUrl]);
  return null;
}

function isSameOrigin(url: string) {
  try { return new URL(url).origin === window.location.origin; } catch { return true; }
}

function getTrafficAttribution(query: URLSearchParams): TrafficAttribution {
  const stored = readStoredAttribution();
  const externalReferrer = getExternalReferrer();
  const explicit = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "gclid", "fbclid"]
    .some((key) => Boolean(clean(query.get(key), 255)));

  if (stored && !explicit && (!externalReferrer || externalReferrer === stored.referrer)) return stored;

  const referrerHost = getReferrerHost(externalReferrer);
  const gclid = clean(query.get("gclid"), 255);
  const fbclid = clean(query.get("fbclid"), 255);
  const inferredSource = gclid ? "google" : fbclid ? "meta" : referrerHost || (explicit ? "unknown" : "direct");
  const inferredMedium = gclid ? "cpc" : fbclid ? "paid_social"
    : referrerHost ? (isSearchReferrer(referrerHost) ? "organic" : "referral") : explicit ? "campaign" : "direct";
  const attribution: TrafficAttribution = {
    referrer: externalReferrer,
    landingUrl: window.location.href,
    utmSource: clean(query.get("utm_source"), 100)?.toLowerCase() || inferredSource,
    utmMedium: clean(query.get("utm_medium"), 100)?.toLowerCase() || inferredMedium,
    utmCampaign: clean(query.get("utm_campaign"), 200),
    utmContent: clean(query.get("utm_content"), 200),
    utmTerm: clean(query.get("utm_term"), 200),
    gclid,
    fbclid,
  };
  try { sessionStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(attribution)); } catch { /* 분석 저장 실패는 서비스 이용을 막지 않습니다. */ }
  return attribution;
}

function readStoredAttribution(): TrafficAttribution | null {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(ATTRIBUTION_KEY) || "null") as Partial<TrafficAttribution> | null;
    return parsed && typeof parsed.landingUrl === "string" ? {
      referrer: typeof parsed.referrer === "string" ? parsed.referrer : null,
      landingUrl: parsed.landingUrl,
      utmSource: typeof parsed.utmSource === "string" ? parsed.utmSource : null,
      utmMedium: typeof parsed.utmMedium === "string" ? parsed.utmMedium : null,
      utmCampaign: typeof parsed.utmCampaign === "string" ? parsed.utmCampaign : null,
      utmContent: typeof parsed.utmContent === "string" ? parsed.utmContent : null,
      utmTerm: typeof parsed.utmTerm === "string" ? parsed.utmTerm : null,
      gclid: typeof parsed.gclid === "string" ? parsed.gclid : null,
      fbclid: typeof parsed.fbclid === "string" ? parsed.fbclid : null,
    } : null;
  } catch { return null; }
}

function getAnalyticsSessionId() {
  try {
    const stored = sessionStorage.getItem(SESSION_ID_KEY);
    if (stored) return stored;
    const sessionId = crypto.randomUUID();
    sessionStorage.setItem(SESSION_ID_KEY, sessionId);
    return sessionId;
  } catch { return null; }
}

function getExternalReferrer() {
  if (!document.referrer) return null;
  try {
    const referrer = new URL(document.referrer);
    return referrer.origin === window.location.origin ? null : referrer.href.slice(0, 2048);
  } catch { return null; }
}

function getReferrerHost(referrer: string | null) {
  try { return referrer ? new URL(referrer).hostname.toLowerCase().replace(/^www\./, "").slice(0, 100) : null; }
  catch { return null; }
}

function isSearchReferrer(host: string) {
  return host === "google.com" || host.startsWith("google.") || host.startsWith("search.naver.")
    || host === "search.daum.net" || host === "bing.com" || host.endsWith(".bing.com")
    || host === "search.zum.com" || host.startsWith("search.yahoo.");
}

function clean(value: string | null, maxLength: number) {
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, maxLength) : null;
}
