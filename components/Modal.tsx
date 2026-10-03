"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * 地図の上に重ねて出す画面の枠（見比べ画面 D に使う）。
 *
 * 閉じるときは router.back()（ブラウザの「戻る」と同じ）にしている。
 * 開いたときに URL が /map/<id> に変わっているので、戻ると /map に戻り、
 * Next.js が地図をそのまま残して重なる画面だけを消してくれる。
 * 「×」・背景・Esc キーのどれでも閉じられるようにする
 */
export function Modal({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") router.back();
    };
    window.addEventListener("keydown", onKey);
    // 重なる画面の裏で、地図のページがスクロールしないようにする
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [router]);

  return (
    <div
      // 地図（Leaflet）の部品より手前に出す
      className="fixed inset-0 z-[1000] flex items-start justify-center overflow-y-auto bg-ink/50 p-4 sm:items-center"
      onClick={(e) => {
        // パネルの外（背景）を押したときだけ閉じる
        if (e.target === e.currentTarget) router.back();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className="relative my-8 w-full max-w-4xl rounded-lg bg-paper p-5 shadow-xl outline-none sm:p-8"
      >
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="閉じる"
          className="absolute right-3 top-3 flex size-9 items-center justify-center rounded-full text-muted transition hover:bg-line hover:text-ink"
        >
          <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
            <path
              d="M6 6l12 12M18 6L6 18"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </button>
        {children}
      </div>
    </div>
  );
}
