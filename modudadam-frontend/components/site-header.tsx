import Link from "next/link";

const navigation = [
  { href: "/", label: "홈" },
  { href: "/about", label: "소개" },
];

export function SiteHeader() {
  return (
    <header className="border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-6">
        <Link href="/" className="text-lg font-bold tracking-tight text-slate-950">
          모두다담
        </Link>
        <nav aria-label="주요 메뉴">
          <ul className="flex items-center gap-6 text-sm font-medium text-slate-600">
            {navigation.map((item) => (
              <li key={item.href}>
                <Link className="transition hover:text-blue-600" href={item.href}>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}
