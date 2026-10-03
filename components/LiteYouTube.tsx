"use client";

import Image from "next/image";
import { useState } from "react";

// 見た目は再生プレーヤーと同じ大きさの画像で、▶ を押した瞬間に本物の
// YouTube プレーヤーに差し替える部品。
//
// プレーヤーを最初から埋め込むと、ページを開くたびに YouTube の重いスクリプトを
// 読み込む（再生しない人も待たされる）。押されるまでは画像1枚で済ませる。
//
// 画像は高画質版（1280px）を使う。大きく表示するので通常版（480px）だと粗い。
// ただし高画質版が無い動画がある（2026-10-01 時点で132本中5本。「思想犯」など）ので、
// 読み込みに失敗したら通常版に切り替える。

export function LiteYouTube({
  videoId,
  title,
  sizes = "(min-width: 768px) 768px, 100vw",
  start,
}: {
  videoId: string;
  title: string;
  /** 表示される幅。細い欄に置くときは小さく指定し、無駄に大きな画像を読ませない */
  sizes?: string;
  /** 再生を始める秒数。聖地の見比べ画面で「その場面から」再生するため */
  start?: number;
}) {
  const [playing, setPlaying] = useState(false);
  const [hiRes, setHiRes] = useState(true);

  if (playing) {
    return (
      <iframe
        className="aspect-video w-full"
        // autoplay=1: 押したのは「再生したい」からなので、もう一度押させない
        src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1${start ? `&start=${start}` : ""}`}
        title={title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setPlaying(true)}
      className="group relative block aspect-video w-full overflow-hidden"
      aria-label={`${title} を再生`}
    >
      <Image
        src={`https://i.ytimg.com/vi/${videoId}/${hiRes ? "maxresdefault" : "hqdefault"}.jpg`}
        alt=""
        fill
        // ページの最初に見える画像なので、遅延読み込みにせず優先して読む。
        // Next.js 16 で priority は非推奨になり、この2つを使うよう案内されている
        loading="eager"
        fetchPriority="high"
        sizes={sizes}
        className="object-cover"
        onError={() => setHiRes(false)}
      />
      {/* 再生ボタン。YouTube の赤ではなくサイトの色に合わせる */}
      <span className="absolute inset-0 flex items-center justify-center bg-ink/10 transition group-hover:bg-ink/25">
        <span className="flex size-16 items-center justify-center rounded-full bg-ink/70 transition group-hover:bg-accent">
          <svg
            viewBox="0 0 24 24"
            className="ml-1 size-7 fill-paper"
            aria-hidden
          >
            <path d="M8 5v14l11-7z" />
          </svg>
        </span>
      </span>
    </button>
  );
}
