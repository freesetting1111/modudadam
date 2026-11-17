"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api";

const RECENT_SEARCH_COOKIE = "modudadam_recent_searches";
const MAX_RECENT_SEARCHES = 10;

export function HomeSearch() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"recent" | "trending">("recent");
  const [query, setQuery] = useState("");
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [trendingKeywords, setTrendingKeywords] = useState<string[]>([]);
  const [trendingLoading, setTrendingLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.setTimeout(() => inputRef.current?.focus(), 0);

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  function openSearch() {
    setRecentSearches(readRecentSearches());
    setOpen(true);
    setTrendingLoading(true);
    apiRequest<{ popularQueries: string[] }>("/api/searches", { cache: "no-store" })
      .then((result) => setTrendingKeywords(result.popularQueries))
      .catch(() => setTrendingKeywords([]))
      .finally(() => setTrendingLoading(false));
  }

  async function search(keyword: string) {
    const normalized = keyword.trim().replace(/\s+/g, " ");
    if (!normalized) return;
    const next = [normalized, ...recentSearches.filter((item) => item !== normalized)].slice(0, MAX_RECENT_SEARCHES);
    writeRecentSearches(next);
    setRecentSearches(next);
    await apiRequest("/api/searches", { method: "POST", body: JSON.stringify({ query: normalized }) }).catch(() => undefined);
    setOpen(false);
    router.push(`/search?q=${encodeURIComponent(normalized)}`);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void search(query);
  }

  function removeRecent(keyword: string) {
    const next = recentSearches.filter((item) => item !== keyword);
    setRecentSearches(next);
    writeRecentSearches(next);
  }

  function clearRecent() {
    setRecentSearches([]);
    writeRecentSearches([]);
  }

  return <section className="home-search">
    <button className="home-search-trigger" type="button" onClick={openSearch} aria-haspopup="dialog">
      <span>궁금한 생활 정보를 검색해 보세요</span><b aria-hidden="true">⌕</b>
    </button>

    {open && <div className="search-overlay" role="dialog" aria-modal="true" aria-label="통합검색">
      <form className="search-overlay-header" onSubmit={submit}>
        <button className="search-back" type="button" onClick={() => setOpen(false)} aria-label="검색 닫기">‹</button>
        <input ref={inputRef} value={query} onChange={(event) => setQuery(event.target.value)} maxLength={100} placeholder="검색어를 입력해 주세요." aria-label="검색어" />
        <button className="search-submit" type="submit" aria-label="검색">⌕</button>
      </form>

      <div className="search-tabs" role="tablist" aria-label="검색어 목록">
        <button type="button" role="tab" aria-selected={tab === "recent"} className={tab === "recent" ? "active" : ""} onClick={() => setTab("recent")}>최근 검색어</button>
        <button type="button" role="tab" aria-selected={tab === "trending"} className={tab === "trending" ? "active" : ""} onClick={() => setTab("trending")}>급상승 검색어</button>
      </div>

      {tab === "recent" ? <div className="recent-search-panel" role="tabpanel">
        {recentSearches.length === 0 ? <p className="no-recent-searches">최근 검색어가 없습니다.</p> : <>
          <ol className="search-keyword-list recent-list">
            {recentSearches.map((keyword) => <li key={keyword}>
              <button className="keyword-button" type="button" onClick={() => void search(keyword)}>{keyword}</button>
              <button className="remove-keyword" type="button" onClick={() => removeRecent(keyword)} aria-label={`${keyword} 삭제`}>×</button>
            </li>)}
          </ol>
          <button className="clear-recent" type="button" onClick={clearRecent}>전체 삭제</button>
        </>}
      </div> : <div role="tabpanel">{trendingLoading ? <p className="no-recent-searches">검색어 순위를 불러오는 중입니다.</p> : trendingKeywords.length === 0 ? <p className="no-recent-searches">아직 집계된 급상승 검색어가 없습니다.</p> : <ol className="search-keyword-list trending-list">
        {trendingKeywords.map((keyword, index) => <li key={keyword}>
          <span className="ranking">{index + 1}</span>
          <button className="keyword-button" type="button" onClick={() => void search(keyword)}>{keyword}</button>
        </li>)}
      </ol>}</div>}

      <button className="search-close" type="button" onClick={() => setOpen(false)}>닫기</button>
    </div>}
  </section>;
}

function readRecentSearches() {
  if (typeof document === "undefined") return [];
  const value = document.cookie.split("; ").find((cookie) => cookie.startsWith(`${RECENT_SEARCH_COOKIE}=`))?.split("=").slice(1).join("=");
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(decodeURIComponent(value));
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string").slice(0, MAX_RECENT_SEARCHES) : [];
  } catch {
    return [];
  }
}

function writeRecentSearches(items: string[]) {
  document.cookie = `${RECENT_SEARCH_COOKIE}=${encodeURIComponent(JSON.stringify(items))}; Max-Age=2592000; Path=/; SameSite=Lax`;
}
