import type { Metadata } from "next";
import Link from "next/link";
import { FeaturedVideo } from "@/components/FeaturedVideo";
import { NewsRow } from "@/components/NewsRow";
import { KIND_LABEL, formatDate, yorushikaWorks } from "@/lib/discography";
import { getSpots } from "@/lib/map";
import {
  getArticles,
  groupSameStories,
  shortDayLabel,
  type ArticleGroup,
} from "@/lib/news/view";
import { isPublishedWithin, videos } from "@/lib/videos";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

// 新しい公式映像が出た直後は映像を一番上に、それ以外はニュースを一番上にする（FRESH_DAYS）。
// ニュースは1時間ごとに増えるので、ページも1時間ごとに作り直す（映像の切り替えもこれで反映される）。
// 映像は押されるまで画像1枚で済ませる（LiteYouTube）。プレーヤーを最初から埋め込むと
// YouTube の重い読み込みを全員が待つことになるため。
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

/** 映像を一番上に大きく出す期間（公開から何日以内か） */
const FRESH_DAYS = 14;

export default async function Home() {
  const news = await latestNews();

  // いちばん新しい公式映像（MVかライブ映像）
  const latest = videos.find((v) => v.kind === "mv" || v.kind === "live");

  // 新しい映像が出た直後だけ、映像を一番上に大きく出す。
  // 公式映像は出ない時期が長い（2026年は4/24「あぶく」から9/18まで約5か月なし）ので、
  // 常に一番上にすると、何か月もトップの一番目立つ場所が同じになってしまう。
  // それ以外の時期は、毎日増えるニュースを一番上にする
  const isFresh =
    latest !== undefined && isPublishedWithin(latest.publishedAt, FRESH_DAYS);

  // 新着リリース（ヨルシカ名義の新しい順に5件）
  const newReleases = yorushikaWorks.slice(0, 5);

  const spots = getSpots();
  const liveCount = spots.filter((s) => s.category === "live").length;
  const eventCount = spots.length - liveCount;

  // ---- 各欄 ----

  // MV一覧へはヘッダーの「MV」から行けるので、映像の欄にはリンクを置かない
  const videoSection = (compact: boolean) =>
    latest && (
      <section>
        <SectionHeading title="最新の公式映像" />
        <div className="mt-4">
          <FeaturedVideo video={latest} compact={compact} />
        </div>
      </section>
    );

  // 見出しを「最新ニュース」にすると、公式映像の近くにあるため公式の発表に見えてしまう。
  // 中身は各メディアやnoteから集めたものなので、/news と同じ名前にしている
  const newsSection = (
    <section className="lg:col-span-2">
      <SectionHeading
        title="ニュースとファンの声"
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
  );

  const mapSection = (
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
  );

  // 横幅が狭い欄なので、日付と種別の下に題名を置く
  const releasesSection = (
    <section>
      <SectionHeading
        title="新着リリース"
        href="/discography"
        linkLabel="作品一覧"
      />
      <ul className="mt-2 divide-y divide-line">
        {newReleases.map((w) => (
          <li key={w.id}>
            <a
              href={w.officialUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="group block py-3"
            >
              <span className="flex items-center gap-2 text-xs tabular-nums text-muted">
                {formatDate(w.releaseDate)}
                <span className="rounded border border-line px-1.5 py-px text-[11px]">
                  {KIND_LABEL[w.kind]}
                </span>
              </span>
              <span className="mt-1 block font-serif text-ink transition group-hover:text-accent">
                {w.title}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );

  // ---- 並べ方 ----
  // PCでは「左にニュース（広め）、右に細い欄」の2列。スマホでは上から順に並ぶ

  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-10">
      <p className="text-sm leading-relaxed text-muted">
        ヨルシカのニュース・ファンの声・作品・MV・ゆかりの場所を、ファンが個人でまとめています。
      </p>

      {isFresh ? (
        <>
          {/* 新しい映像がある時期: 映像を一番上に大きく */}
          <div className="mt-8">{videoSection(false)}</div>
          <div className="mt-12 grid grid-cols-1 gap-12 lg:grid-cols-3 lg:gap-10">
            {newsSection}
            <div className="space-y-12">
              {mapSection}
              {releasesSection}
            </div>
          </div>
        </>
      ) : (
        // それ以外の時期: ニュースを一番上に、映像は右の欄に小さく
        <div className="mt-8 grid grid-cols-1 gap-12 lg:grid-cols-3 lg:gap-10">
          {newsSection}
          <div className="space-y-12">
            {videoSection(true)}
            {mapSection}
            {releasesSection}
          </div>
        </div>
      )}
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
