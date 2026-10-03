"use client";

import { useState } from "react";

/**
 * Googleマップの埋め込み（現地の写真・ストリートビュー）。
 * 写真は一般の人がGoogleマップに上げたもので、こちらで保存せずGoogleの表示機能で見せている。
 *
 * 一覧では押したときだけ読み込む（何個も並ぶとページがとても重くなるため）。
 * 見比べ画面では最初から開く（startOpen）。1画面に1〜2個なので重さは問題にならない
 */
export function MapEmbed({
  src,
  title,
  startOpen = false,
}: {
  src: string;
  title: string;
  startOpen?: boolean;
}) {
  const [open, setOpen] = useState(startOpen);

  if (startOpen) {
    return (
      <iframe
        src={src}
        title={title}
        className="aspect-video w-full rounded-lg border border-line"
        loading="lazy"
        referrerPolicy="strict-origin-when-cross-origin"
        allowFullScreen
      />
    );
  }

  return (
    <span className="basis-full">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="text-xs text-muted transition hover:text-accent"
      >
        {open ? "現地の写真を閉じる" : "現地の写真を見る"}
      </button>
      {open && (
        <iframe
          src={src}
          title={title}
          className="mt-2 aspect-video w-full max-w-xl rounded-md border border-line"
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
        />
      )}
    </span>
  );
}
