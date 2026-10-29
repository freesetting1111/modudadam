import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "소개",
};

const foundations = [
  ["Frontend", "Next.js App Router 기반의 페이지와 공통 컴포넌트"],
  ["Backend", "Route Handler 기반의 독립적인 API 서버"],
  ["Environment", "환경변수로 분리된 프런트엔드와 백엔드 연결 주소"],
];

export default function AboutPage() {
  return (
    <section className="mx-auto w-full max-w-5xl px-6 py-20">
      <p className="text-sm font-semibold text-blue-600">프로젝트 소개</p>
      <h1 className="mt-3 text-4xl font-bold tracking-tight">모두다담의 기본 구조</h1>
      <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
        화면과 API의 책임을 분리하고, 기능이 늘어나도 관리하기 쉬운 구조로 시작합니다.
      </p>
      <div className="mt-12 grid gap-4 md:grid-cols-3">
        {foundations.map(([title, description]) => (
          <article key={title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="font-semibold text-slate-950">{title}</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">{description}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
