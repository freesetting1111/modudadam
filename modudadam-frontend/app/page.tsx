import Link from "next/link";
import { BackendStatus } from "@/components/backend-status";
import { API_BASE_URL } from "@/lib/config";

export default function Home() {
  return (
    <section className="mx-auto flex min-h-[calc(100vh-137px)] w-full max-w-5xl flex-col justify-center px-6 py-20">
      <BackendStatus />
      <p className="mt-8 text-sm font-semibold uppercase tracking-[0.2em] text-blue-600">
        Modudadam
      </p>
      <h1 className="mt-4 max-w-3xl text-4xl font-bold tracking-tight text-slate-950 sm:text-6xl">
        모두의 이야기를
        <br />한 곳에 담아요.
      </h1>
      <p className="mt-6 max-w-xl text-lg leading-8 text-slate-600">
        프런트엔드와 API 서버의 기본 연결이 준비되었습니다. 이제 모두다담의 핵심 기능을 이 위에 쌓아가면 됩니다.
      </p>
      <div className="mt-10 flex flex-wrap gap-3">
        <Link
          href="/about"
          className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
        >
          프로젝트 소개
        </Link>
        <a
          href={`${API_BASE_URL}/api`}
          className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-400"
        >
          API 확인
        </a>
      </div>
    </section>
  );
}
