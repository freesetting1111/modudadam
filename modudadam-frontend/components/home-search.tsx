"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const RECENT_SEARCH_COOKIE = "modudadam_recent_searches";
const MAX_RECENT_SEARCHES = 10;

const trendingKeywords = [
  { keyword: "반려동물 건강", movement: "NEW" },
  { keyword: "오늘 저녁 메뉴", movement: "NEW" },
  { keyword: "냉장고 정리", movement: "▲ 2" },
  { keyword: "서울 나들이", movement: "NEW" },
  { keyword: "홈트레이닝", movement: "▲ 3" },
  { keyword: "아이와 갈만한 곳", movement: "―" },
  { keyword: "봄 코디", movement: "NEW" },
  { keyword: "자격증 공부", movement: "▲ 1" },
  { keyword: "자동차 관리", movement: "▼ 2" },
  { keyword: "주말 영화 추천", movement: "NEW" },
];

export function HomeSearch() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"recent" | "trending">("recent");
  const [query, setQuery] = useState("");
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

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
  }

  function search(keyword: string) {
    const normalized = keyword.trim().replace(/\s+/g, " ");
    if (!normalized) return;
    const next = [normalized, ...recentSearches.filter((item) => item !== normalized)].slice(0, MAX_RECENT_SEARCHES);
    writeRecentSearches(next);
    setRecentSearches(next);
    setOpen(false);
    router.push(`/search?q=${encodeURIComponent(normalized)}`);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    search(query);
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
              <button className="keyword-button" type="button" onClick={() => search(keyword)}>{keyword}</button>
              <button className="remove-keyword" type="button" onClick={() => removeRecent(keyword)} aria-label={`${keyword} 삭제`}>×</button>
            </li>)}
          </ol>
          <button className="clear-recent" type="button" onClick={clearRecent}>전체 삭제</button>
        </>}
      </div> : <ol className="search-keyword-list trending-list" role="tabpanel">
        {trendingKeywords.map(({ keyword, movement }, index) => <li key={keyword}>
          <span className="ranking">{index + 1}.</span>
          <button className="keyword-button" type="button" onClick={() => search(keyword)}>{keyword}</button>
          <span className={`movement ${movement.startsWith("▼") ? "down" : ""}`}>{movement}</span>
        </li>)}
      </ol>}

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
