import type { Metadata } from "next";
import Link from "next/link";
import { VideoCard } from "@/components/VideoCard";
import { KIND_LABEL, formatDate, yorushikaWorks } from "@/lib/discography";
import { OFFICIAL_LINKS } from "@/lib/links";
import { byKind, videos } from "@/lib/videos";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

// このページはビルド時に一度だけ作られる（静的生成）。
// データはJSONファイルなので、アクセスのたびに作り直す必要がない。

export default function Home() {
  // いちばん新しい公式映像（MVかライブ映像）
  const latest = videos.find((v) => v.kind === "mv" || v.kind === "live");

  // 新着リリース（ヨルシカ名義の新しい順に5件）
  const newReleases = yorushikaWorks.slice(0, 5);

  // 再生回数の多いMV
  const popular = [...byKind("mv")]
    .sort((a, b) => b.viewCount - a.viewCount)
    .slice(0, 6);

  // 公式リンクから主要なものだけ
  const mainLinks = OFFICIAL_LINKS.flatMap((g) => g.links).slice(0, 6);

  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-10">
      <p className="text-sm leading-relaxed text-muted">
        ヨルシカの作品・MV・ライブ映像・公式リンクを、ファンが個人でまとめています。
      </p>

      {/* 最新の公式映像。公式の埋め込みプレーヤーで見られる */}
      {latest && (
        <section className="mt-8">
          <h2 className="font-serif text-xl text-ink">最新の公式映像</h2>
          <div className="mt-4 overflow-hidden rounded-lg border border-line bg-ink">
            <iframe
              className="aspect-video w-full"
              src={`https://www.youtube-nocookie.com/embed/${latest.videoId}`}
              title={latest.name}
              loading="lazy"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
          <Link
            href={`/mv/${latest.videoId}`}
            className="mt-2 inline-block font-serif text-ink transition hover:text-accent"
          >
            {latest.name}
          </Link>
        </section>
      )}

      {/* 新着リリース */}
      <section className="mt-12">
        <div className="flex items-baseline justify-between">
          <h2 className="font-serif text-xl text-ink">新着リリース</h2>
          <Link
            href="/discography"
            className="text-sm text-muted transition hover:text-accent"
          >
            作品一覧へ
          </Link>
        </div>
        <ul className="mt-4 divide-y divide-line border-y border-line">
          {newReleases.map((w) => (
            <li key={w.id}>
              <a
                href={w.officialUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex flex-wrap items-baseline gap-x-4 gap-y-1 py-3"
              >
                <span className="w-24 shrink-0 text-sm tabular-nums text-muted">
                  {formatDate(w.releaseDate)}
                </span>
                <span className="shrink-0 rounded border border-line px-1.5 py-0.5 text-[11px] text-muted">
                  {KIND_LABEL[w.kind]}
                </span>
                <span className="font-serif text-ink transition group-hover:text-accent">
                  {w.title}
                </span>
              </a>
            </li>
          ))}
        </ul>
      </section>

      {/* 人気のMV */}
      <section className="mt-12">
        <div className="flex items-baseline justify-between">
          <h2 className="font-serif text-xl text-ink">よく再生されているMV</h2>
          <Link
            href="/mv"
            className="text-sm text-muted transition hover:text-accent"
          >
            MV一覧へ
          </Link>
        </div>
        <ul className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
          {popular.map((v, i) => (
            <VideoCard key={v.videoId} video={v} rank={i + 1} />
          ))}
        </ul>
      </section>

      {/* 公式リンク（抜粋） */}
      <section className="mt-12">
        <div className="flex items-baseline justify-between">
          <h2 className="font-serif text-xl text-ink">公式リンク</h2>
          <Link
            href="/links"
            className="text-sm text-muted transition hover:text-accent"
          >
            すべて見る
          </Link>
        </div>
        <ul className="mt-4 flex flex-wrap gap-2">
          {mainLinks.map((l) => (
            <li key={l.url}>
              <a
                href={l.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block rounded-full border border-line bg-card px-4 py-1.5 text-sm text-ink transition hover:border-accent hover:text-accent"
              >
                {l.label}
              </a>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
