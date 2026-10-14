"use client";

import { useEffect, useRef, useState } from "react";
import { TURNSTILE_SITE_KEY } from "@/lib/site";

// 聖地の見比べ画面の「みんなの写真」。ファンが撮った現地の写真を並べ、投稿もここからできる。
//
// 方針（オーナーの判断）: 承認制にせず、投稿したらすぐ公開する。その代わり、
// 送る前に確認画面で中身を見てもらい、位置情報はブラウザとサーバーの両方で消し、
// 通報がたまれば自動で非表示、投稿した人はこのブラウザからいつでも消せる。
//
// 聖地のページは静的なまま、この欄だけブラウザから /api/photos に取りに行く。

type FanPhoto = {
  id: number;
  url: string;
  width: number;
  height: number;
  comment: string | null;
  name: string | null;
  takenMonth: string | null;
  createdAt: string;
};

/** 投稿した写真の削除の合言葉。このブラウザにだけ保存する（{写真のid: 合言葉}） */
const TOKENS_KEY = "yorushika-photo-tokens";

function readTokens(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(TOKENS_KEY) ?? "{}");
  } catch {
    return {};
  }
}
function saveToken(id: number, token: string) {
  try {
    localStorage.setItem(
      TOKENS_KEY,
      JSON.stringify({ ...readTokens(), [id]: token }),
    );
  } catch {
    // 保存できない環境（プライベートモードなど）では、後から自分で消せないだけ
  }
}

/** 「2025-08」→「2025年8月に撮影」 */
function monthLabel(m: string) {
  const [y, mm] = m.split("-");
  return `${y}年${Number(mm)}月に撮影`;
}

export function FanPhotos({
  spotId,
  spotName,
}: {
  spotId: string;
  spotName: string;
}) {
  const [photos, setPhotos] = useState<FanPhoto[] | null>(null);
  const [tokens, setTokens] = useState<Record<string, string>>({});
  const [formOpen, setFormOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const enabled = TURNSTILE_SITE_KEY !== "";

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/photos?spot=${encodeURIComponent(spotId)}`, {
      cache: reloadKey ? "no-store" : "default",
    })
      .then((r) => (r.ok ? r.json() : { photos: [] }))
      .then((d: { photos: FanPhoto[] }) => {
        if (cancelled) return;
        setPhotos(d.photos);
        setTokens(readTokens());
      })
      .catch(() => !cancelled && setPhotos([]));
    return () => {
      cancelled = true;
    };
  }, [spotId, reloadKey]);

  async function report(p: FanPhoto) {
    if (
      !confirm(
        "この写真を通報しますか？（知らない人が写っている・この場所と関係ない・他人の写真の無断転載 など）",
      )
    )
      return;
    await fetch(`/api/photos/${p.id}/report`, { method: "POST" });
    alert("通報しました。ありがとうございます。");
  }

  async function remove(p: FanPhoto) {
    if (!confirm("この写真を消しますか？（元に戻せません）")) return;
    const res = await fetch(`/api/photos/${p.id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: tokens[p.id] }),
    });
    if (res.ok) setReloadKey((k) => k + 1);
    else alert("消せませんでした");
  }

  return (
    <section className="mt-8">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-serif text-lg text-ink">みんなの写真</h2>
        {enabled && !formOpen && (
          <button
            type="button"
            onClick={() => setFormOpen(true)}
            className="rounded-full border border-accent px-4 py-1 text-sm text-accent transition hover:bg-accent hover:text-card"
          >
            写真を投稿する
          </button>
        )}
      </div>

      {formOpen && (
        <PhotoForm
          spotId={spotId}
          spotName={spotName}
          onClose={() => setFormOpen(false)}
          onPosted={(id, token) => {
            saveToken(id, token);
            setFormOpen(false);
            setReloadKey((k) => k + 1);
          }}
        />
      )}

      {photos === null ? (
        <p className="mt-2 text-sm text-muted">読み込み中…</p>
      ) : photos.length === 0 ? (
        <p className="mt-2 text-sm text-muted">
          {enabled
            ? "まだ写真はありません。行ったことがあれば、最初の1枚を投稿してみてください。"
            : "写真の投稿は準備中です。"}
        </p>
      ) : (
        // 縦長・横長が混ざるので、列に流し込んで並べる（高さをそろえて切り抜かない）
        <ul className="mt-3 columns-2 gap-3 sm:columns-3">
          {photos.map((p) => (
            <li key={p.id} className="mb-3 break-inside-avoid">
              <figure className="overflow-hidden rounded-lg border border-line bg-card">
                {/* 投稿された写真は R2 から直接返すので next/image を通さない */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.url}
                  alt={`${spotName}でファンが撮った写真`}
                  width={p.width}
                  height={p.height}
                  loading="lazy"
                  className="h-auto w-full"
                />
                <figcaption className="px-2 py-1.5 text-xs leading-relaxed">
                  {p.comment && (
                    <span className="block text-ink">{p.comment}</span>
                  )}
                  <span className="text-muted">
                    {p.name ?? "名無しのファン"}
                    {p.takenMonth && `・${monthLabel(p.takenMonth)}`}
                  </span>
                  <span className="mt-1 flex gap-3 text-muted">
                    <button
                      type="button"
                      onClick={() => report(p)}
                      className="transition hover:text-accent"
                    >
                      通報
                    </button>
                    {tokens[p.id] && (
                      <button
                        type="button"
                        onClick={() => remove(p)}
                        className="transition hover:text-accent"
                      >
                        自分の投稿を消す
                      </button>
                    )}
                  </span>
                </figcaption>
              </figure>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// --------------------------------------------------------------
// 投稿フォーム（入力 → 確認 → 送信）
// --------------------------------------------------------------

type Prepared = { blob: Blob; url: string; width: number; height: number };

/**
 * 写真を長い辺 1600px までに縮め、JPEG に描き直す。
 * 描き直すと、写真に入っていた位置情報や撮影機器の情報は消える（サーバーでも念のため消す）。
 * スマホの写真の向き（縦横）は imageOrientation で正しく直してから描く
 */
async function prepareImage(file: File): Promise<Prepared> {
  const bitmap = await createImageBitmap(file, {
    imageOrientation: "from-image",
  });
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("変換できませんでした"))),
      "image/jpeg",
      0.85,
    ),
  );
  return { blob, url: URL.createObjectURL(blob), width, height };
}

type TurnstileApi = {
  render(
    el: HTMLElement,
    opts: {
      sitekey: string;
      callback: (token: string) => void;
      "expired-callback": () => void;
    },
  ): string;
  remove(id: string): void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

/** Turnstile のスクリプトはページに1回だけ読み込む */
let turnstilePromise: Promise<TurnstileApi> | null = null;
function loadTurnstile() {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  turnstilePromise ??= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src =
      "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    s.onload = () => resolve(window.turnstile!);
    s.onerror = reject;
    document.head.append(s);
  });
  return turnstilePromise;
}

function PhotoForm({
  spotId,
  spotName,
  onClose,
  onPosted,
}: {
  spotId: string;
  spotName: string;
  onClose: () => void;
  onPosted: (id: number, token: string) => void;
}) {
  const [step, setStep] = useState<"edit" | "confirm">("edit");
  const [image, setImage] = useState<Prepared | null>(null);
  const [comment, setComment] = useState("");
  const [name, setName] = useState("");
  const [month, setMonth] = useState("");
  const [ownPhoto, setOwnPhoto] = useState(false);
  const [noFaces, setNoFaces] = useState(false);
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const widgetBox = useRef<HTMLDivElement>(null);

  // 確認画面で Turnstile を出す（入力中に出すと、時間が経って期限切れになりやすいため）
  useEffect(() => {
    if (step !== "confirm") return;
    let id: string | null = null;
    let cancelled = false;
    loadTurnstile()
      .then((t) => {
        if (cancelled || !widgetBox.current) return;
        id = t.render(widgetBox.current, {
          sitekey: TURNSTILE_SITE_KEY,
          callback: setToken,
          "expired-callback": () => setToken(""),
        });
      })
      .catch(() => setError("確認の仕組みを読み込めませんでした"));
    return () => {
      cancelled = true;
      if (id) window.turnstile?.remove(id);
    };
  }, [step]);

  async function pick(file: File | undefined) {
    setError("");
    if (!file) return;
    try {
      setImage(await prepareImage(file));
    } catch {
      setError(
        "この写真は読み込めませんでした。JPEG か PNG の写真を選んでください。",
      );
    }
  }

  async function send() {
    if (!image || !token) return;
    setSending(true);
    setError("");
    const form = new FormData();
    form.set("spotId", spotId);
    form.set("photo", image.blob, "photo.jpg");
    form.set("comment", comment);
    form.set("name", name);
    form.set("takenMonth", month);
    form.set("ownPhoto", ownPhoto ? "1" : "0");
    form.set("noFaces", noFaces ? "1" : "0");
    form.set("turnstile", token);
    const res = await fetch("/api/photos", { method: "POST", body: form });
    const data = (await res.json().catch(() => ({}))) as {
      id?: number;
      deleteToken?: string;
      error?: string;
    };
    setSending(false);
    if (res.ok && data.id && data.deleteToken) {
      onPosted(data.id, data.deleteToken);
    } else {
      setError(data.error ?? "投稿できませんでした");
      setToken("");
      setStep("edit");
    }
  }

  const ready = image && ownPhoto && noFaces;

  return (
    <div className="mt-3 rounded-lg border border-line bg-card px-4 py-4 text-sm">
      {step === "edit" ? (
        <>
          <p className="text-ink">{spotName}で撮った写真を投稿する</p>
          <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs leading-relaxed text-muted">
            <li>
              自分で撮った写真だけを投稿してください（MVの画面や、他の人の写真は投稿できません）。
            </li>
            <li>
              写真に入っている撮影場所などの情報は、自動で消してから保存します。
            </li>
            <li>
              写真の著作権は撮った人のものです。このサイトに表示することを許可していただく形になります。
            </li>
            <li>
              投稿はすぐに公開されます。このブラウザからなら、いつでも自分で消せます。
            </li>
          </ul>

          <label className="mt-4 block">
            <span className="text-xs text-muted">写真（必須）</span>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => pick(e.target.files?.[0])}
              className="mt-1 block w-full text-sm"
            />
          </label>
          {image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={image.url}
              alt="投稿する写真"
              className="mt-2 max-h-64 rounded-md border border-line"
            />
          )}

          <label className="mt-3 block">
            <span className="text-xs text-muted">
              ひとこと（任意・100字まで）
            </span>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              maxLength={100}
              rows={2}
              className="mt-1 block w-full rounded-md border border-line bg-paper px-2 py-1"
              placeholder="夕方に行ったらMVと同じ色の空でした"
            />
          </label>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs text-muted">名前（任意・20字まで）</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={20}
                className="mt-1 block w-full rounded-md border border-line bg-paper px-2 py-1"
                placeholder="空欄なら「名無しのファン」"
              />
            </label>
            <label className="block">
              <span className="text-xs text-muted">撮った年月（任意）</span>
              <input
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="mt-1 block w-full rounded-md border border-line bg-paper px-2 py-1"
              />
            </label>
          </div>

          <label className="mt-4 flex items-start gap-2">
            <input
              type="checkbox"
              checked={ownPhoto}
              onChange={(e) => setOwnPhoto(e.target.checked)}
              className="mt-1"
            />
            <span>自分で撮った写真です</span>
          </label>
          <label className="mt-1 flex items-start gap-2">
            <input
              type="checkbox"
              checked={noFaces}
              onChange={(e) => setNoFaces(e.target.checked)}
              className="mt-1"
            />
            <span>知らない人の顔や車のナンバーが、はっきり写っていません</span>
          </label>

          {error && <p className="mt-3 text-accent">{error}</p>}

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              disabled={!ready}
              onClick={() => setStep("confirm")}
              className="rounded-full bg-accent px-5 py-1.5 text-card transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              確認へ進む
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-line px-5 py-1.5 text-muted transition hover:text-accent"
            >
              やめる
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="text-ink">この内容で投稿します。よろしいですか？</p>
          {image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={image.url}
              alt="投稿する写真"
              className="mt-2 max-h-72 rounded-md border border-line"
            />
          )}
          <p className="mt-2 text-ink">{comment || "（ひとことなし）"}</p>
          <p className="text-xs text-muted">
            {name || "名無しのファン"}
            {month && `・${monthLabel(month)}`}
          </p>
          {/* ボット避けの確認。ふつうは自動で済み、たまに1回押すだけになる */}
          <div ref={widgetBox} className="mt-3 min-h-[65px]" />
          {error && <p className="mt-2 text-accent">{error}</p>}
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              disabled={!token || sending}
              onClick={send}
              className="rounded-full bg-accent px-5 py-1.5 text-card transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {sending ? "送信中…" : "投稿する"}
            </button>
            <button
              type="button"
              disabled={sending}
              onClick={() => {
                setToken("");
                setStep("edit");
              }}
              className="rounded-full border border-line px-5 py-1.5 text-muted transition hover:text-accent"
            >
              戻って直す
            </button>
          </div>
        </>
      )}
    </div>
  );
}
