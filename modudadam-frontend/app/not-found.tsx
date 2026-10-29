import Link from "next/link";

export default function NotFound() {
  return (
    <section className="mx-auto flex min-h-[calc(100vh-137px)] max-w-5xl flex-col items-center justify-center px-6 text-center">
      <p className="text-sm font-semibold text-blue-600">404</p>
      <h1 className="mt-3 text-3xl font-bold">페이지를 찾을 수 없습니다</h1>
      <p className="mt-4 text-slate-600">주소를 다시 확인하거나 홈으로 돌아가 주세요.</p>
      <Link href="/" className="mt-8 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white">
        홈으로 돌아가기
      </Link>
    </section>
  );
}
