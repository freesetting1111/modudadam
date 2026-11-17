"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { getAnonymousId } from "@/lib/anonymous-id";
import { SearchResults } from "@/components/search-results";

const RECENT_SEARCH_COOKIE = "modudadam_recent_searches";
const MAX_RECENT_SEARCHES = 10;
type TrendingKeyword = { query: string; searchCount: number; currentRank: number; previousRank: number | null; rankChange: number | null; direction: "up" | "same" | "down" | "new" };

export function HomeSearch({ mode = "trigger", initialQuery = "" }: { mode?: "trigger" | "page"; initialQuery?: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const searchDataRequested = useRef(false);
  const [open, setOpen] = useState(mode === "page");
  const [tab, setTab] = useState<"recent" | "trending">("recent");
  const [query, setQuery] = useState(initialQuery);
  const [submittedQuery, setSubmittedQuery] = useState(initialQuery);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [trendingKeywords, setTrendingKeywords] = useState<TrendingKeyword[]>([]);
  const [trendingLoading, setTrendingLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    const initialize = window.setTimeout(() => {
      setRecentSearches(readRecentSearches());
      setTrendingLoading(true);
      if (!searchDataRequested.current) {
        searchDataRequested.current = true;
        apiRequest<{ trendingQueries: TrendingKeyword[] }>("/api/searches", { cache: "no-store" })
          .then((result) => setTrendingKeywords(result.trendingQueries))
          .catch(() => setTrendingKeywords([]))
          .finally(() => setTrendingLoading(false));
      }
    }, 0);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.setTimeout(() => inputRef.current?.focus(), 0);

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (mode === "page") router.push("/");
      else setOpen(false);
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.clearTimeout(initialize);
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [mode, open, router]);

  function openSearch() {
    searchDataRequested.current = false;
    setOpen(true);
  }

  async function search(keyword: string) {
    const normalized = keyword.trim().replace(/\s+/g, " ");
    if (!normalized) return;
    const next = [normalized, ...recentSearches.filter((item) => item !== normalized)].slice(0, MAX_RECENT_SEARCHES);
    writeRecentSearches(next);
    setRecentSearches(next);
    await apiRequest("/api/searches", { method: "POST", body: JSON.stringify({ query: normalized, anonymousId: getAnonymousId() }) }).catch(() => undefined);
    if (mode === "trigger") {
      setOpen(false);
      router.push(`/search?q=${encodeURIComponent(normalized)}`);
      return;
    }
    setSubmittedQuery(normalized);
    router.replace(`/search?q=${encodeURIComponent(normalized)}`, { scroll: false });
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

  function closeSearch() {
    searchDataRequested.current = false;
    if (mode === "page") router.push("/");
    else setOpen(false);
  }

  return <section className={mode === "page" ? "unified-search-page" : "home-search"}>
    {mode === "trigger" && <button className="home-search-trigger" type="button" onClick={openSearch} aria-haspopup="dialog">
      <span>궁금한 생활 정보를 검색해 보세요</span><span className="home-search-icon" aria-hidden="true"><Search strokeWidth={2}/></span>
    </button>}

    {open && <div className="search-overlay" role="dialog" aria-modal="true" aria-label="통합검색">
      <form className="search-overlay-header" onSubmit={submit}>
        <button className="search-back" type="button" onClick={closeSearch} aria-label="검색 닫기">‹</button>
        <input ref={inputRef} value={query} onChange={(event) => setQuery(event.target.value)} maxLength={100} placeholder="검색어를 입력해 주세요." aria-label="검색어" />
        <button className="search-submit" type="submit" aria-label="검색"><Search strokeWidth={2}/></button>
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
        {trendingKeywords.map((keyword, index) => <li key={keyword.query}>
          <span className="ranking">{index + 1}</span>
          <button className="keyword-button" type="button" onClick={() => void search(keyword.query)}>{keyword.query}</button>
          <span className={`rank-change ${keyword.direction}`} aria-label={rankChangeLabel(keyword)}>{keyword.direction === "same" ? <i>-</i> : <><i aria-hidden="true" />{keyword.direction === "new" ? "NEW" : Math.abs(keyword.rankChange || 0)}</>}</span>
        </li>)}
      </ol>}</div>}

      {submittedQuery && <SearchResults key={submittedQuery} initialQuery={submittedQuery} hideForm />}

      {mode === "trigger" && <button className="search-close" type="button" onClick={closeSearch}>닫기</button>}
    </div>}
  </section>;
}

function rankChangeLabel(keyword: TrendingKeyword) {
  if (keyword.direction === "new") return "새로 진입";
  if (keyword.direction === "same") return "순위 유지";
  return `${Math.abs(keyword.rankChange || 0)}순위 ${keyword.direction === "up" ? "상승" : "하락"}`;
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
