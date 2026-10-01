import Link from "next/link";
import { LiteYouTube } from "@/components/LiteYouTube";
import { VIDEO_KIND_LABEL, formatPublished, type Video } from "@/lib/videos";

// 「最新の公式映像」の欄。トップと MV ページの一番上で共用する。
// 大きく見せたいが、画面の高さを全部使うと下のニュースや新着が見えなくなるので、
// 横幅を max-w-3xl（768px、高さ約430px）までに抑えている。
export function FeaturedVideo({ video }: { video: Video }) {
  return (
    <div className="max-w-3xl">
      <div className="overflow-hidden rounded-lg border border-line bg-ink">
        <LiteYouTube videoId={video.videoId} title={video.name} />
      </div>
      <div className="mt-2 flex flex-wrap items-baseline gap-x-3">
        <Link
          href={`/mv/${video.videoId}`}
          className="font-serif text-lg text-ink transition hover:text-accent"
        >
          {video.name}
        </Link>
        <span className="text-xs tabular-nums text-muted">
          {VIDEO_KIND_LABEL[video.kind]} ・ {formatPublished(video.publishedAt)}{" "}
          公開
        </span>
      </div>
    </div>
  );
}
