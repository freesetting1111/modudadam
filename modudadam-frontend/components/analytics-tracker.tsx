"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const ANONYMOUS_KEY = "modudadam_anonymous_id";

export function AnalyticsTracker() {
  const pathname = usePathname();
  useEffect(() => {
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
    const anonymousId = getAnonymousId();
    let active = true;
    async function heartbeat() {
      if (document.visibilityState === "hidden") return;
      try {
        const response = await fetch("/api/visitors/presence", {
          method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ anonymousId, path: window.location.pathname }),
        });
        const payload = await response.json() as { success?: boolean; data?: { onlineCount?: number } };
        if (active && payload.success && typeof payload.data?.onlineCount === "number") {
          window.dispatchEvent(new CustomEvent("modudadam:visitor-count", { detail: { onlineCount: payload.data.onlineCount } }));
        }
      } catch { /* 방문자 표시는 서비스 이용을 방해하지 않습니다. */ }
    }
    void heartbeat();
    const interval = window.setInterval(() => void heartbeat(), 60_000);
    const handleFocus = () => void heartbeat();
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleFocus);
    return () => { active = false; window.clearInterval(interval); window.removeEventListener("focus", handleFocus); document.removeEventListener("visibilitychange", handleFocus); };
  }, []);
  return null;
}

function getAnonymousId() {
  let anonymousId = localStorage.getItem(ANONYMOUS_KEY);
  if (!anonymousId) { anonymousId = crypto.randomUUID(); localStorage.setItem(ANONYMOUS_KEY, anonymousId); }
  return anonymousId;
}
