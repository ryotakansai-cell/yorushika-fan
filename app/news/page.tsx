import type { Metadata } from "next";
import Link from "next/link";
import { NewsRow } from "@/components/NewsRow";
import {
  TABS,
  getArticles,
  groupByDay,
  groupSameStories,
  timeLabel,
  type Tab,
} from "@/lib/news/view";

export const metadata: Metadata = {
  alternates: { canonical: "/news" },
  title: "ニュースとファンの声",
  description:
    "ヨルシカのニュース・公式のお知らせ・noteの感想や考察・海外ファンの投稿を、新しい順にまとめて読めるページ。1時間ごとに自動で更新しています。",
};

type Props = {
  searchParams: Promise<{ tab?: string }>;
};

function toTab(v: string | undefined): Tab {
  return TABS.some((t) => t.value === v) ? (v as Tab) : "all";
}

export default async function NewsPage({ searchParams }: Props) {
  const tab = toTab((await searchParams).tab);
  const articles = await getArticles(tab);
  const groups = groupSameStories(articles);
  const isTopic = tab === "topic";

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-10">
      <h1 className="font-serif text-2xl text-ink">ニュースとファンの声</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        ニュース・公式のお知らせ・noteの感想や考察・海外ファンの投稿を集めて、新しい順に並べています。1時間ごとに自動で更新しています。見出しを押すと元の記事が開きます。
      </p>

      {/* タブ。押すとURLの ?tab= が変わる */}
      <nav className="mt-6 flex gap-1 overflow-x-auto border-b border-line">
        {TABS.map((t) => {
          const active = t.value === tab;
          return (
            <Link
              key={t.value}
              href={t.value === "all" ? "/news" : `/news?tab=${t.value}`}
              aria-current={active ? "page" : undefined}
              className={`-mb-px shrink-0 border-b-2 px-3 py-2 text-sm transition ${
                active
                  ? "border-accent text-accent"
                  : "border-transparent text-muted hover:text-accent"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>

      {isTopic && (
        <p className="mt-4 text-xs text-muted">
          はてなブックマークで多く保存された記事を、ブックマーク数の多い順に並べています。
        </p>
      )}

      {groups.length === 0 ? (
        <p className="mt-8 text-sm text-muted">まだ記事がありません。</p>
      ) : isTopic ? (
        // 「話題」は日付で区切らず、ブックマーク数の順にそのまま並べる
        <ul className="mt-4 divide-y divide-line">
          {groups.map((g) => (
            <NewsRow key={g.main.id} group={g} />
          ))}
        </ul>
      ) : (
        groupByDay(groups).map((day) => (
          <section key={day.label} className="mt-8">
            <h2 className="border-b border-line pb-2 font-serif text-base text-ink">
              {day.label}
            </h2>
            <ul className="divide-y divide-line">
              {day.items.map((g) => (
                <NewsRow
                  key={g.main.id}
                  group={g}
                  stamp={timeLabel(g.main.publishedAt)}
                />
              ))}
            </ul>
          </section>
        ))
      )}
    </main>
  );
}
