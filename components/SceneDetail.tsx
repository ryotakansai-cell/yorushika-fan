import Image from "next/image";
import Link from "next/link";
import { LiteYouTube } from "@/components/LiteYouTube";
import { MapEmbed } from "@/components/MapEmbed";
import type { SceneDetail as Detail } from "@/lib/map";

// 聖地の見比べ画面（D）の中身。/map/<id> の単独ページと、地図に重なる画面の両方で使う。
// 左に「MVのその場面」、右に「現地」を並べて、見比べられるようにする。
//
// 現地の見せ方は、使えるものから順に:
//   1. Googleマップの埋め込み（写真・ストリートビュー）… オーナーが場面ごとに登録したもの
//   2. Wikimedia Commons の写真 … 場所ごとに1枚
//   3. どちらも無ければ、ストリートビューを開くリンク
// 画像をこのサイトに保存しないのは、他人の写真の著作権のため（Commonsは条件付きで使える）
export function SceneDetail({ detail: d }: { detail: Detail }) {
  return (
    <article>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1 className="font-serif text-2xl text-ink">{d.name}</h1>
        <span className="text-sm text-muted">{d.prefecture}</span>
        {d.evidenceLabel && (
          <span
            className={`rounded border px-1.5 py-px text-xs ${
              d.evidence === "estimate"
                ? "border-line text-muted"
                : "border-accent text-accent"
            }`}
          >
            {d.evidenceLabel}
          </span>
        )}
      </div>
      {d.note && (
        <p className="mt-2 text-sm leading-relaxed text-muted">{d.note}</p>
      )}

      {d.scenes.map((sc, i) => (
        <section key={`${sc.videoId}-${sc.at ?? i}`} className="mt-8">
          <h2 className="font-serif text-lg text-ink">
            {sc.work}
            <span className="ml-2 text-sm text-muted">
              {sc.atLabel ? `${sc.atLabel} の場面` : "場面の時刻は未確認"}
            </span>
          </h2>
          {sc.note && <p className="mt-1 text-xs text-muted">{sc.note}</p>}

          <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
            <figure>
              <div className="overflow-hidden rounded-lg border border-line bg-ink">
                <LiteYouTube
                  videoId={sc.videoId}
                  title={`${sc.work}（MV）`}
                  start={sc.at}
                  sizes="(min-width: 768px) 384px, 100vw"
                />
              </div>
              <figcaption className="mt-1 text-xs text-muted">
                MV（公式YouTube）
                {sc.atLabel && `・押すと ${sc.atLabel} から再生`}
              </figcaption>
            </figure>

            <figure>
              <Present scene={sc} detail={d} />
            </figure>
          </div>
        </section>
      ))}

      {d.sources.length > 0 && (
        <p className="mt-8 text-xs leading-relaxed text-muted">
          出典：
          {d.sources.map((src, i) => (
            <span key={src.url}>
              {i > 0 && "、"}
              <a
                href={src.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-ink transition hover:text-accent"
              >
                {src.label}
              </a>
            </span>
          ))}
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-sm">
        <a
          href={d.googleMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted transition hover:text-accent"
        >
          Google マップで開く
        </a>
        <a
          href={d.streetViewUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted transition hover:text-accent"
        >
          ストリートビューで見る
        </a>
        <Link
          href={`/map#scene:${d.id}`}
          className="text-muted transition hover:text-accent"
        >
          聖地巡礼マップで見る
        </Link>
      </div>
    </article>
  );
}

/** 右側の「現地」。埋め込み → Commons の写真 → リンクの順に、使えるもので見せる */
function Present({
  scene: sc,
  detail: d,
}: {
  scene: Detail["scenes"][number];
  detail: Detail;
}) {
  if (sc.embed) {
    return (
      <>
        <MapEmbed src={sc.embed} title={`${d.name}の現地の様子`} startOpen />
        <figcaption className="mt-1 text-xs text-muted">
          現地（Googleマップ）
        </figcaption>
      </>
    );
  }
  if (d.photo) {
    return (
      <>
        <a href={d.photo.page} target="_blank" rel="noopener noreferrer">
          <div className="relative aspect-video overflow-hidden rounded-lg border border-line bg-line">
            <Image
              src={d.photo.thumb}
              alt={`${d.name}の写真`}
              fill
              sizes="(min-width: 768px) 384px, 100vw"
              className="object-cover"
            />
          </div>
        </a>
        {/* 自由ライセンスの写真は、撮影者名とライセンスを表示する決まり */}
        <figcaption className="mt-1 text-xs text-muted">
          現地の写真：{d.photo.artist}（{d.photo.license}、Wikimedia Commons）
        </figcaption>
      </>
    );
  }
  return (
    <div className="flex aspect-video flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-line text-sm text-muted">
      <span>現地の写真はまだありません</span>
      <a
        href={sc.ref?.url ?? d.streetViewUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-ink transition hover:text-accent"
      >
        {sc.ref ? sc.ref.label : "ストリートビューで見る"}
      </a>
    </div>
  );
}
