"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { getAnonymousId } from "@/lib/anonymous-id";

export function AnalyticsTracker({ backendUrl }: { backendUrl: string }) {
  const pathname = usePathname();
  const directBackendUrl = backendUrl.replace(/\/+$/, "");
  useEffect(() => {
    if (isLocalDevelopment()) return;
    const anonymousId = getAnonymousId();
    const query = new URLSearchParams(window.location.search);
    const firstLanding = sessionStorage.getItem("modudadam_landing_url") || window.location.href;
    sessionStorage.setItem("modudadam_landing_url", firstLanding);
    void fetch("/api/access-logs", {
      method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        eventName: "page_view", anonymousId, path: pathname, queryString: window.location.search,
        pageTitle: document.title, referrer: document.referrer || null, landingUrl: firstLanding,
        utmSource: query.get("utm_source"), utmMedium: query.get("utm_medium"),
        utmCampaign: query.get("utm_campaign"), utmContent: query.get("utm_content"),
        utmTerm: query.get("utm_term"), gclid: query.get("gclid"), fbclid: query.get("fbclid"),
        deviceType: window.innerWidth < 768 ? "mobile" : "desktop",
        viewportWidth: window.innerWidth, viewportHeight: window.innerHeight,
        locale: navigator.language, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        occurredAt: new Date().toISOString(),
      }),
    }).catch(() => undefined);
  }, [pathname]);
  useEffect(() => {
    if (isLocalDevelopment()) return;
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

function isLocalDevelopment() {
  return window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1" || window.location.hostname === "::1";
}
