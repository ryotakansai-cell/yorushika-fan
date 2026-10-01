import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { NewsRow } from "@/components/NewsRow";
import { KIND_LABEL, formatDate, yorushikaWorks } from "@/lib/discography";
import { getSpots } from "@/lib/map";
import {
  getArticles,
  groupSameStories,
  shortDayLabel,
  type ArticleGroup,
} from "@/lib/news/view";
import { formatPublished, thumbnail, videos } from "@/lib/videos";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

// トップの主役はニュース（このサイトにしか無い部分）。
// ニュースは1時間ごとに増えるので、ページも1時間ごとに作り直す。
// MVの埋め込みプレーヤーはやめてサムネイル1枚にした。YouTube のプレーヤーは
// 読み込みが重く、トップを開くたびにそれを待たせる理由が無いため。
export const revalidate = 3600;

const NEWS_COUNT = 8;

/** DBが落ちていてもトップ自体は表示したいので、失敗したらニュース欄を空にして続ける */
async function latestNews(): Promise<ArticleGroup[] | null> {
  try {
    // 同じニュースを1行にまとめると件数が減るので、多めに取ってからまとめる
    const articles = await getArticles("all", NEWS_COUNT * 4);
    return groupSameStories(articles).slice(0, NEWS_COUNT);
  } catch (e) {
    console.error("トップのニュース取得に失敗", e);
    return null;
  }
}

export default async function Home() {
  const news = await latestNews();

  // いちばん新しい公式映像（MVかライブ映像）
  const latest = videos.find((v) => v.kind === "mv" || v.kind === "live");

  // 新着リリース（ヨルシカ名義の新しい順に5件）
  const newReleases = yorushikaWorks.slice(0, 5);

  const spots = getSpots();
  const liveCount = spots.filter((s) => s.category === "live").length;
  const eventCount = spots.length - liveCount;

  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-10">
      <p className="text-sm leading-relaxed text-muted">
        ヨルシカのニュース・ファンの声・作品・MV・ゆかりの場所を、ファンが個人でまとめています。
      </p>

      {/* PCでは「ニュース（広め）＋ 右に映像とマップ」の2列。スマホでは上から順に並ぶ */}
      <div className="mt-8 grid grid-cols-1 gap-12 lg:grid-cols-3 lg:gap-10">
        {/* 1. 最新ニュース */}
        <section className="lg:col-span-2">
          <SectionHeading
            title="最新ニュース"
            href="/news"
            linkLabel="もっと見る"
          />
          {news === null ? (
            <p className="mt-4 text-sm text-muted">
              ニュースを読み込めませんでした。時間をおいて開き直してください。
            </p>
          ) : news.length === 0 ? (
            <p className="mt-4 text-sm text-muted">まだ記事がありません。</p>
          ) : (
            <ul className="mt-2 divide-y divide-line">
              {news.map((g) => (
                <NewsRow
                  key={g.main.id}
                  group={g}
                  stamp={shortDayLabel(g.main.publishedAt)}
                />
              ))}
            </ul>
          )}
        </section>

        <div className="space-y-12">
          {/* 2. 最新の公式映像（サムネイル1枚。押すとサイト内の動画ページで再生） */}
          {latest && (
            <section>
              <SectionHeading
                title="最新の公式映像"
                href="/mv"
                linkLabel="MV一覧"
              />
              <Link href={`/mv/${latest.videoId}`} className="group mt-4 block">
                <div className="relative aspect-video overflow-hidden rounded-lg border border-line bg-ink">
                  <Image
                    src={thumbnail(latest.videoId)}
                    alt={latest.name}
                    fill
                    sizes="(min-width: 1024px) 320px, 100vw"
                    className="object-cover transition group-hover:opacity-90"
                  />
                </div>
                <p className="mt-2 font-serif text-ink transition group-hover:text-accent">
                  {latest.name}
                </p>
                <p className="text-xs tabular-nums text-muted">
                  {formatPublished(latest.publishedAt)} 公開
                </p>
              </Link>
            </section>
          )}

          {/* 3. 聖地巡礼マップへの入口 */}
          <section>
            <SectionHeading title="聖地巡礼マップ" />
            <Link
              href="/map"
              className="group mt-4 block rounded-lg border border-line bg-card px-4 py-4 transition hover:border-accent"
            >
              <span className="font-serif text-ink transition group-hover:text-accent">
                ゆかりの場所を地図で見る
              </span>
              <span className="mt-1 block text-xs leading-relaxed text-muted">
                ライブ会場 {liveCount} か所・展示やコラボの開催場所 {eventCount}{" "}
                か所。すべて公式の告知を出典にしています。
              </span>
            </Link>
          </section>
        </div>
      </div>

      {/* 4. 新着リリース */}
      <section className="mt-12">
        <SectionHeading
          title="新着リリース"
          href="/discography"
          linkLabel="作品一覧へ"
        />
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
    </main>
  );
}

/** 各欄の見出し。右端に一覧ページへのリンクを置く */
function SectionHeading({
  title,
  href,
  linkLabel,
}: {
  title: string;
  href?: string;
  linkLabel?: string;
}) {
  return (
    <div className="flex items-baseline justify-between">
      <h2 className="font-serif text-xl text-ink">{title}</h2>
      {href && (
        <Link
          href={href}
          className="text-sm text-muted transition hover:text-accent"
        >
          {linkLabel}
        </Link>
      )}
    </div>
  );
}
