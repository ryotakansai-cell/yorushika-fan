import Image from "next/image";
import Link from "next/link";
import {
  formatDuration,
  formatPublished,
  formatViews,
  thumbnail,
  type Video,
} from "@/lib/videos";

/**
 * 動画1本ぶんのカード。押すとサイト内の動画ページ（/mv/動画ID）へ。
 * そこで公式の埋め込みプレーヤーで再生する。
 *
 * スマホでは「サムネ左・文字右」の横並び、sm（640px）以上では縦積み。
 * ゲームトレンドで、スマホでサムネが画面幅いっぱいに巨大化した反省を活かしている。
 */
export function VideoCard({
  video,
  rank,
}: {
  video: Video;
  /** ランキング表示のときだけ順位を出す */
  rank?: number;
}) {
  return (
    <li className="group">
      <Link href={`/mv/${video.videoId}`} className="flex gap-3 sm:block">
        <div className="relative aspect-video w-40 shrink-0 overflow-hidden rounded-md border border-line bg-line sm:w-auto">
          <Image
            src={thumbnail(video.videoId)}
            alt={video.name}
            fill
            sizes="(min-width: 640px) 33vw, 160px"
            className="object-cover transition duration-500 group-hover:scale-105"
          />
          {rank !== undefined && (
            <span className="absolute left-1.5 top-1.5 rounded bg-ink/80 px-1.5 py-0.5 text-[11px] text-paper">
              {rank}
            </span>
          )}
          <span className="absolute bottom-1.5 right-1.5 rounded bg-ink/80 px-1.5 py-0.5 text-[11px] text-paper">
            {formatDuration(video.seconds)}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 font-serif text-[15px] text-ink transition group-hover:text-accent sm:mt-2">
            {video.name}
          </p>
          <p className="mt-1 text-xs text-muted">
            {formatViews(video.viewCount)}回再生 ・{" "}
            {formatPublished(video.publishedAt)}
          </p>
        </div>
      </Link>
    </li>
  );
}
