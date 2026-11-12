"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const ANONYMOUS_KEY = "modudadam_anonymous_id";

export function AnalyticsTracker() {
  const pathname = usePathname();
  useEffect(() => {
    let anonymousId = localStorage.getItem(ANONYMOUS_KEY);
    if (!anonymousId) { anonymousId = crypto.randomUUID(); localStorage.setItem(ANONYMOUS_KEY, anonymousId); }
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
  return null;
}
