import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { NewsRow } from "@/components/NewsRow";
import { VideoCard } from "@/components/VideoCard";
import { formatDate, KIND_LABEL } from "@/lib/discography";
import {
  getArticlesMentioning,
  groupSameStories,
  shortDayLabel,
} from "@/lib/news/view";
import {
  ELMA_DIARY_URL,
  diaryForSong,
  findSong,
  scenesForSong,
  songs,
  videosForSong,
} from "@/lib/songs";

// 曲ごとのページ。収録作品・映像・聖地・エルマの日記・ニュースを、曲を中心に1ページにまとめる。
// 「憂一乗 聖地」「ノーチラス 意味」のような検索から来た人の入口にもなる。
// 歌詞は載せない（公式サイトの歌詞ページへリンクする）

type Props = { params: Promise<{ id: string }> };

// 全曲ぶんをビルド時に作る。ニュースだけは増えていくので、1日1回作り直す
export function generateStaticParams() {
  return songs.map((s) => ({ id: String(s.id) }));
}
export const dynamicParams = false;
export const revalidate = 86400;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const song = findSong(Number((await params).id));
  if (!song) return { title: "見つかりません" };
  const work = song.works[0];
  return {
    title: `${song.title}（ヨルシカ）`,
    description: `ヨルシカ「${song.title}」${work ? `（${work.title}収録）` : ""}のMV・ライブ映像、聖地、関連ニュースをまとめています。`,
    alternates: { canonical: `/songs/${song.id}` },
  };
}

/** DBが落ちていても曲ページ自体は表示したいので、失敗したらニュース欄を出さない */
async function news(title: string) {
  try {
    return await getArticlesMentioning(title);
  } catch (e) {
    console.error("曲ページのニュース取得に失敗", e);
    return [];
  }
}

export default async function SongPage({ params }: Props) {
  const song = findSong(Number((await params).id));
  if (!song) notFound();

  const videoList = videosForSong(song.title);
  const scenes = scenesForSong(song.title);
  const days = diaryForSong(song.title);
  // 同じニュースを複数の媒体が報じたものは1行にまとめる（ニュース一覧と同じ基準）
  const newsGroups = groupSameStories(await news(song.title));

  return (
    <main className="mx-auto w-full max-w-4xl px-5 py-10">
      <p className="text-xs text-muted">
        <Link href="/songs" className="transition hover:text-accent">
          曲
        </Link>
      </p>
      <h1 className="mt-1 font-serif text-3xl text-ink">{song.title}</h1>

      {/* 収録作品。タイトルは公式の作品ページへ */}
      <ul className="mt-4 space-y-1 text-sm">
        {song.works.map((w) => (
          <li key={w.id} className="flex flex-wrap items-baseline gap-x-2">
            <span className="w-24 shrink-0 tabular-nums text-muted">
              {formatDate(w.releaseDate)}
            </span>
            <a
              href={w.officialUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-ink transition hover:text-accent"
            >
              {w.title}
            </a>
            <span className="text-xs text-muted">
              {w.format || KIND_LABEL[w.kind]}
            </span>
          </li>
        ))}
      </ul>

      {/* 歌詞は著作物なのでこのサイトには載せず、公式サイトの歌詞ページへ案内する */}
      <p className="mt-5">
        <a
          href={song.lyricsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block rounded-full border border-line bg-card px-4 py-1.5 text-sm text-ink transition hover:border-accent hover:text-accent"
        >
          公式サイトで歌詞を見る
        </a>
      </p>

      {videoList.length > 0 && (
        <section className="mt-12">
          <h2 className="font-serif text-lg text-ink">映像</h2>
          <ul className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {videoList.map((v) => (
              <VideoCard key={v.videoId} video={v} />
            ))}
          </ul>
        </section>
      )}

      {scenes.length > 0 && (
        <section className="mt-12">
          <div className="flex items-baseline justify-between">
            <h2 className="font-serif text-lg text-ink">この曲の舞台</h2>
            <Link
              href="/map"
              className="text-sm text-muted transition hover:text-accent"
            >
              聖地巡礼マップへ
            </Link>
          </div>
          <ul className="mt-3 divide-y divide-line border-y border-line">
            {scenes.map((sc) => (
              <li
                key={`${sc.spotId}-${sc.at ?? sc.atLabel ?? ""}`}
                className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-3"
              >
                <Link
                  href={sc.detailHref}
                  className="font-serif text-ink transition hover:text-accent"
                >
                  {sc.name}
                </Link>
                <span className="text-xs text-muted">{sc.prefecture}</span>
                {sc.atLabel && (
                  <span className="text-xs text-muted">
                    {sc.atLabel === "ジャケット"
                      ? "ジャケット写真"
                      : `MV ${sc.atLabel} の場面`}
                  </span>
                )}
                {sc.evidenceLabel && (
                  <span
                    className={`rounded border px-1.5 py-px text-xs ${
                      sc.evidence === "estimate"
                        ? "border-line text-muted"
                        : "border-accent text-accent"
                    }`}
                  >
                    {sc.evidenceLabel}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 『エルマ』の曲は、エルマの日記のどの日に、どこで書かれたかが分かる */}
      {days.length > 0 && (
        <section className="mt-12">
          <div className="flex items-baseline justify-between">
            <h2 className="font-serif text-lg text-ink">エルマの日記で</h2>
            <Link
              href="/elma"
              className="text-sm text-muted transition hover:text-accent"
            >
              エルマの旅を地図でたどる
            </Link>
          </div>
          <ul className="mt-3 space-y-2 text-sm">
            {days.map((d) => (
              <li key={d.date} className="flex gap-3">
                <span className="w-12 shrink-0 tabular-nums text-muted">
                  {d.date}
                </span>
                <span className="text-ink">
                  <span className="text-muted">{d.town}</span>　{d.summary}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted">
            日記の内容を短くまとめたものです。日記の全文は
            <a
              href={ELMA_DIARY_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-ink transition hover:text-accent"
            >
              公式サイト
            </a>
            で読めます。
          </p>
        </section>
      )}

      {newsGroups.length > 0 && (
        <section className="mt-12">
          <div className="flex items-baseline justify-between">
            <h2 className="font-serif text-lg text-ink">この曲のニュース</h2>
            <Link
              href="/news"
              className="text-sm text-muted transition hover:text-accent"
            >
              ニュース一覧へ
            </Link>
          </div>
          <ul className="mt-2 divide-y divide-line">
            {newsGroups.map((g) => (
              <NewsRow
                key={g.main.id}
                group={g}
                stamp={shortDayLabel(g.main.publishedAt)}
              />
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
