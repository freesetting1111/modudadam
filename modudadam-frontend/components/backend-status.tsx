"use client";

import { useEffect, useState } from "react";
import { API_BASE_URL } from "@/lib/config";

type ConnectionState = "checking" | "online" | "offline";

type HealthResponse = {
  success: boolean;
  data: {
    status: string;
  };
};

export function BackendStatus() {
  const [connection, setConnection] = useState<ConnectionState>("checking");

  useEffect(() => {
    const controller = new AbortController();

    async function checkBackend() {
      try {
        const response = await fetch(`${API_BASE_URL}/api/health`, {
          signal: controller.signal,
        });
        const result = (await response.json()) as HealthResponse;

        setConnection(response.ok && result.data.status === "ok" ? "online" : "offline");
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setConnection("offline");
        }
      }
    }

    void checkBackend();

    return () => controller.abort();
  }, []);

  const state = {
    checking: { color: "bg-amber-400", text: "연결 확인 중" },
    online: { color: "bg-emerald-500", text: "백엔드 연결됨" },
    offline: { color: "bg-rose-500", text: "백엔드 연결 안 됨" },
  }[connection];

  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 shadow-sm">
      <span className={`h-2 w-2 rounded-full ${state.color}`} aria-hidden="true" />
      <span>{state.text}</span>
    </div>
  );
}
