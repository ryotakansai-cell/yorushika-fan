import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { VideoCard } from "@/components/VideoCard";
import { findSingle, formatDate } from "@/lib/discography";
import { getScenesForVideo } from "@/lib/map";
import {
  VIDEO_KIND_LABEL,
  byKind,
  findVideo,
  formatDuration,
  formatPublished,
  formatViews,
  videos,
} from "@/lib/videos";

type Props = {
  params: Promise<{ videoId: string }>;
};

// ビルド時に、全動画ぶんのページを作っておく（静的生成）。
// データがJSONファイルにあるので、どの動画IDのページが必要かを事前に列挙できる
export function generateStaticParams() {
  return videos.map((v) => ({ videoId: v.videoId }));
}

// 上で列挙していない動画IDのURLは、その場で作らずに404にする
export const dynamicParams = false;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { videoId } = await params;
  const video = findVideo(videoId);
  if (!video) return { title: "見つかりません" };

  const label = VIDEO_KIND_LABEL[video.kind];
  return {
    title: `${video.name}（${label}）`,
    description: `ヨルシカ「${video.name}」の${label}。公開日 ${formatPublished(video.publishedAt)}、${formatViews(video.viewCount)}回再生。`,
    alternates: { canonical: `/mv/${video.videoId}` },
  };
}

export default async function VideoPage({ params }: Props) {
  const { videoId } = await params;
  const video = findVideo(videoId);
  if (!video) notFound();

  // MVなら、その曲が出たシングルを公式のディスコグラフィーから探す
  const single = video.kind === "mv" ? findSingle(video.name) : undefined;

  // このMVに出てくる場所（聖地巡礼マップの「MVの舞台」）
  const scenes = getScenesForVideo(video.videoId);

  // 同じ種類の他の映像（自分以外で新しい順に4本）
  const others = byKind(video.kind)
    .filter((v) => v.videoId !== video.videoId)
    .slice(0, 4);

  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-10">
      {/* 公式の埋め込みプレーヤー。youtube-nocookie.com は、
          再生ボタンを押すまで閲覧履歴用のCookieを置かない版のYouTube */}
      <div className="overflow-hidden rounded-lg border border-line bg-ink">
        <iframe
          className="aspect-video w-full"
          src={`https://www.youtube-nocookie.com/embed/${video.videoId}`}
          title={video.name}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>

      <p className="mt-5 text-xs text-muted">{VIDEO_KIND_LABEL[video.kind]}</p>
      <h1 className="mt-1 font-serif text-2xl text-ink">{video.name}</h1>
      <p className="mt-2 text-sm text-muted">
        {formatPublished(video.publishedAt)} 公開 ・{" "}
        {formatViews(video.viewCount)}回再生 ・ {formatDuration(video.seconds)}
      </p>

      <ul className="mt-5 flex flex-wrap gap-2 text-sm">
        <li>
          <a
            href={`https://www.youtube.com/watch?v=${video.videoId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block rounded-full border border-line bg-card px-4 py-1.5 text-ink transition hover:border-accent hover:text-accent"
          >
            YouTubeで見る
          </a>
        </li>
        {/* 歌詞は著作物なのでこのサイトには載せず、公式サイトの掲載ページへ案内する */}
        {(video.kind === "mv" || video.kind === "live") && (
          <li>
            <a
              href="https://yorushika.com/discography/artist/2/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block rounded-full border border-line bg-card px-4 py-1.5 text-ink transition hover:border-accent hover:text-accent"
            >
              公式サイトで歌詞を見る
            </a>
          </li>
        )}
        {single && (
          <li>
            <a
              href={single.officialUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block rounded-full border border-line bg-card px-4 py-1.5 text-ink transition hover:border-accent hover:text-accent"
            >
              {single.format || "シングル"}（{formatDate(single.releaseDate)}）
            </a>
          </li>
        )}
      </ul>

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
          <p className="mt-1 text-xs text-muted">
            公式が場所を明言したものではありません。根拠はマップで出典と一緒に確かめられます。
          </p>
          <ul className="mt-3 divide-y divide-line border-y border-line">
            {scenes.map((sc) => (
              <li
                key={`${sc.spotId}-${sc.at ?? ""}`}
                className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-3"
              >
                <Link
                  href={`/map#${sc.spotId}`}
                  className="font-serif text-ink transition hover:text-accent"
                >
                  {sc.name}
                </Link>
                <span className="text-xs text-muted">{sc.prefecture}</span>
                <span
                  className={`rounded border px-1.5 py-px text-xs ${
                    sc.evidence === "estimate"
                      ? "border-line text-muted"
                      : "border-accent text-accent"
                  }`}
                >
                  {sc.evidenceLabel}
                </span>
                {/* 場面の時刻は、その場面から YouTube で開く（埋め込みプレーヤーは操作できないため） */}
                {sc.at !== undefined && (
                  <a
                    href={`https://www.youtube.com/watch?v=${video.videoId}&t=${sc.at}s`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm tabular-nums text-muted transition hover:text-accent"
                  >
                    {sc.atLabel} の場面
                  </a>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {others.length > 0 && (
        <section className="mt-14">
          <div className="flex items-baseline justify-between">
            <h2 className="font-serif text-lg text-ink">
              ほかの{VIDEO_KIND_LABEL[video.kind]}
            </h2>
            <Link
              href="/mv"
              className="text-sm text-muted transition hover:text-accent"
            >
              一覧へ
            </Link>
          </div>
          <ul className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-4">
            {others.map((v) => (
              <VideoCard key={v.videoId} video={v} />
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
