"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SITE_NAME } from "@/lib/site";

// 全ページ共通のヘッダー。ゲームトレンドと同じ考え方で、
// ナビゲーションはここに集約して各ページに「戻る」リンクを置かない。
// 今どこにいるかを出すために現在のURL（usePathname）が要るので、
// ブラウザ側で動くクライアントコンポーネントにしている。

const NAV = [
  { href: "/", label: "ホーム", match: (p: string) => p === "/" },
  {
    href: "/news",
    label: "ニュース",
    match: (p: string) => p.startsWith("/news"),
  },
  {
    href: "/discography",
    label: "作品",
    match: (p: string) => p.startsWith("/discography"),
  },
  { href: "/mv", label: "MV", match: (p: string) => p.startsWith("/mv") },
  {
    href: "/links",
    label: "公式リンク",
    match: (p: string) => p.startsWith("/links"),
  },
];

export function SiteHeader() {
  const pathname = usePathname() ?? "/";

  return (
    <header className="border-b border-line bg-paper/90">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-x-6 px-5">
        <Link
          href="/"
          className="py-4 font-serif text-lg tracking-wide text-ink transition hover:text-accent"
        >
          {SITE_NAME}
        </Link>

        {/* 狭い画面で項目があふれたら横スクロールさせる */}
        <nav className="-mb-px flex gap-1 overflow-x-auto">
          {NAV.map((item) => {
            const active = item.match(pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                // 現在地は差し色＋下線、それ以外は控えめな色で hover すると差し色
                className={`shrink-0 border-b-2 px-3 py-4 text-sm transition ${
                  active
                    ? "border-accent text-accent"
                    : "border-transparent text-muted hover:text-accent"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
