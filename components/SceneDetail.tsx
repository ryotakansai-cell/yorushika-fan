import Image from "next/image";
import Link from "next/link";
import { AerialMiniMap } from "@/components/AerialMiniMap";
import { LiteYouTube } from "@/components/LiteYouTube";
import { MapEmbed } from "@/components/MapEmbed";
import { ScenePlayer } from "@/components/ScenePlayer";
import type { SceneDetail as Detail } from "@/lib/map";

// 聖地の見比べ画面（D）の中身。/map/<id> の単独ページと、地図に重なる画面の両方で使う。
// 左に「MVのその場面」、右に「現地」を並べて、見比べられるようにする。
//
// 現地の見せ方は、使えるものから順に:
//   1. Googleマップの埋め込み（写真・ストリートビュー）… オーナーが場面ごとに登録したもの
//   2. Wikimedia Commons の写真 … 場所ごとに1枚
//   3. どちらも無ければ、その場所の航空写真（国土地理院。日本中どこでも出せる）
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
              {/* 左右の見出し。「見比べる」という言葉を使わずに、何と何が並んでいるかを示す */}
              <p className="mb-1 text-xs text-muted">MVの場面</p>
              <div className="overflow-hidden rounded-lg border border-line bg-ink">
                {/* 場面の秒数が分かっていれば、その場面で止まった状態で出す。
                    分からなければ、押すと最初から再生される普通のプレーヤー */}
                {sc.at !== undefined ? (
                  <ScenePlayer
                    videoId={sc.videoId}
                    start={sc.at}
                    title={`${sc.work}（MV）`}
                  />
                ) : (
                  <LiteYouTube
                    videoId={sc.videoId}
                    title={`${sc.work}（MV）`}
                    sizes="(min-width: 768px) 384px, 100vw"
                  />
                )}
              </div>
              {/* 注釈は付けない。見出しの「0:48 の場面」で十分（2026-10-03 オーナーの指摘） */}
            </figure>

            <figure>
              <p className="mb-1 text-xs text-muted">今の景色</p>
              <Present scene={sc} detail={d} />
            </figure>
          </div>
        </section>
      ))}

      {/* 巡礼メモ。実際に行く人が知りたいこと（行き方・時間・撮り方・今の様子・マナー） */}
      {d.memo && <Memo memo={d.memo} />}

      {/* 近くの聖地。歩いて回れる範囲（2km 以内）にある別の聖地 */}
      {d.nearby.length > 0 && (
        <section className="mt-8">
          <h2 className="font-serif text-lg text-ink">近くの聖地</h2>
          <ul className="mt-2 divide-y divide-line border-y border-line text-sm">
            {d.nearby.map((n) => (
              <li
                key={n.id}
                className="flex flex-wrap items-baseline gap-x-3 py-2"
              >
                {/* 地図の上に重なっている画面から押しても、重なる画面のまま中身が切り替わる。
                    replace: 履歴を足さずに置き換える。足すと、閉じる（＝戻る）を押したときに
                    地図ではなく1つ前の聖地に戻ってしまった（2026-10-03 確認） */}
                <Link
                  href={`/map/${n.id}`}
                  scroll={false}
                  replace
                  className="font-serif text-ink transition hover:text-accent"
                >
                  {n.name}
                </Link>
                <span className="text-xs text-muted">{n.works}</span>
                <span className="ml-auto text-xs tabular-nums text-muted">
                  直線で{n.distanceLabel}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

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

/** 右側の「現地」。埋め込み → Commons の写真 → 航空写真の順に、使えるもので見せる */
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
          Googleマップ
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
          撮影：{d.photo.artist}（{d.photo.license}・Wikimedia Commons）
        </figcaption>
      </>
    );
  }
  // 写真も埋め込みも無い場所は、その場所の航空写真を出す（空の枠にしない）
  return (
    <>
      <AerialMiniMap lat={d.lat} lon={d.lon} title={`${d.name}の航空写真`} />
      <figcaption className="mt-1 text-xs text-muted">
        航空写真（国土地理院）
      </figcaption>
    </>
  );
}

const MEMO_ITEMS = [
  ["access", "行き方"],
  ["when", "おすすめの時間・季節"],
  ["tips", "同じ構図で見るには"],
  ["now", "今の様子"],
  ["manners", "マナー・注意"],
] as const;

/** 巡礼メモ。書かれている項目だけ出す。要点は自分の言葉でまとめ、出典を必ず添える */
function Memo({ memo }: { memo: NonNullable<Detail["memo"]> }) {
  return (
    <section className="mt-8">
      <h2 className="font-serif text-lg text-ink">巡礼メモ</h2>
      <dl className="mt-2 space-y-3 text-sm leading-relaxed">
        {MEMO_ITEMS.map(
          ([key, label]) =>
            memo[key] && (
              <div key={key}>
                <dt className="text-xs text-muted">{label}</dt>
                <dd className="text-ink">{memo[key]}</dd>
              </div>
            ),
        )}
      </dl>
      <p className="mt-2 text-xs text-muted">
        参考：
        {memo.sources.map((src, i) => (
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
    </section>
  );
}
