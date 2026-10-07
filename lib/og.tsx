// SNS にURLを貼ったときに出る画像（OGP 画像）を作るための共通部品。
// app/opengraph-image.tsx（サイト共通）と app/map/[slug]/opengraph-image.tsx（聖地ごと）で使う。
// 画像はビルド時に1回だけ作られる（静的生成）。ここでの取得はビルド中にしか走らない
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const OG_SIZE = { width: 1200, height: 630 };

// サイトと同じ色（app/globals.css の @theme）
export const OG_COLORS = {
  paper: "#f7f5f0",
  ink: "#262626",
  accent: "#3d6485",
  muted: "#6b6b6b",
};

const UA = "yorushika-fan/1.0 (+https://yorushika.sukinote.com)";

/**
 * Google Fonts から「使う文字だけ」入ったフォントを取ってくる。
 * 日本語フォントを丸ごと渡すと数MBあり、画像生成の上限（500KB）を超えるため。
 * UA を付けずに頼むと、画像生成が読める ttf 形式で返ってくる（woff2 は読めない）
 */
async function loadFont(family: string, weight: number, text: string) {
  const css = await (
    await fetch(
      `https://fonts.googleapis.com/css2?family=${family.replace(/ /g, "+")}:wght@${weight}&text=${encodeURIComponent(text)}`,
    )
  ).text();
  const url = css.match(
    /src: url\((.+?)\) format\('(?:truetype|opentype)'\)/,
  )?.[1];
  if (!url) throw new Error(`${family} のフォントを取得できませんでした`);
  return (await fetch(url)).arrayBuffer();
}

/** 見出し（明朝）と本文（ゴシック）。画像に出す文字をまとめて渡す */
export async function ogFonts(text: string) {
  // 数字・英字・記号は毎回出るので、渡し忘れで豆腐（□）にならないよう常に足しておく
  const all = text + "0123456789abcdefghijklmnopqrstuvwxyz.-/（）「」・";
  const [serif, sans] = await Promise.all([
    loadFont("Noto Serif JP", 600, all),
    loadFont("Noto Sans JP", 500, all),
  ]);
  return [
    {
      name: "serif",
      data: serif,
      weight: 600 as const,
      style: "normal" as const,
    },
    {
      name: "sans",
      data: sans,
      weight: 500 as const,
      style: "normal" as const,
    },
  ];
}

/** サイトのアイコン（紙と墨の三日月）。画像の中に埋め込める形にする */
export async function ogMark() {
  const svg = await readFile(join(process.cwd(), "app/icon.svg"));
  return `data:image/svg+xml;base64,${svg.toString("base64")}`;
}

/**
 * 外の画像を取ってきて、画像の中に埋め込める形にする。
 * Wikimedia は連絡先の入った UA を求めているので、自分で UA を付けて取る
 */
export async function ogFetchImage(url: string) {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok)
    throw new Error(`画像を取得できませんでした: ${res.status} ${url}`);
  const type = res.headers.get("content-type") ?? "image/jpeg";
  const buf = Buffer.from(await res.arrayBuffer());
  return `data:${type};base64,${buf.toString("base64")}`;
}

/**
 * 国土地理院の航空写真（シームレス空中写真）で、その地点を中心にした w×h の画像を作るためのタイル。
 * 写真が無い場所に使う。出典の表示が条件で、加工してよい
 */
export async function ogAerialTiles(
  lat: number,
  lon: number,
  w: number,
  h: number,
  z = 17,
) {
  const n = 2 ** z;
  const xt = ((lon + 180) / 360) * n;
  const la = (lat * Math.PI) / 180;
  const yt =
    ((1 - Math.log(Math.tan(la) + 1 / Math.cos(la)) / Math.PI) / 2) * n;
  const cols = Math.ceil(w / 256 / 2) + 1;
  const rows = Math.ceil(h / 256 / 2) + 1;
  const tiles: { src: string; left: number; top: number }[] = [];
  for (let dx = -cols; dx <= cols; dx++) {
    for (let dy = -rows; dy <= rows; dy++) {
      const tx = Math.floor(xt) + dx;
      const ty = Math.floor(yt) + dy;
      const left = (tx - xt) * 256 + w / 2;
      const top = (ty - yt) * 256 + h / 2;
      if (left > w || top > h || left < -256 || top < -256) continue;
      tiles.push({
        src: await ogFetchImage(
          `https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/${z}/${tx}/${ty}.jpg`,
        ),
        left,
        top,
      });
    }
  }
  return tiles;
}
