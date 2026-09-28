// 公式サイトのディスコグラフィーを取得して data/discography.json に保存する。
//
// なぜ手で書かずにスクリプトにするか:
// - 曲名や発売日を記憶や手入力で書くと、必ず間違いが混ざる
// - 新しい作品が出たら、これを再実行するだけで更新できる
//
// 取得するのは「名義・種類・タイトル・発売日・公式ページのURL」という事実の情報だけ。
// ジャケット画像は著作物なので取得も表示もしない（公式ページへのリンクで代える）。
//
// 使い方: npm run fetch:discography
import fs from "node:fs";

const BASE = "https://yorushika.com";
const OUT = "data/discography.json";

// 公式サイトに負荷をかけないよう、1ページごとに少し待つ
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** HTMLの文字参照（&amp; など）を普通の文字に戻す */
function decode(s) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'");
}

/**
 * 「【ALBUM】3rd Full Album「盗作」」のような公式の表記を分解する。
 *   category … 【】の中（ALBUM、配信、Blu-ray & DVD など）
 *   format   … 】と「の間（3rd Full Album、Digital Single など）
 *   title    … 「」の中。無い場合（【書簡型小説】二人称）は残り全部
 */
function parseTitle(raw) {
  const m = raw.match(/^【\s*(.+?)\s*】\s*(.*)$/);
  const category = m ? m[1] : "";
  const rest = m ? m[2] : raw;

  const q = rest.match(/^(.*?)「(.+)」\s*(.*)$/);
  if (q) {
    return {
      category,
      format: q[1].trim(),
      title: q[2].trim(),
      // 「」の後ろに注記がある場合（例: （フジファブリック原曲カバー））
      note: q[3].trim(),
    };
  }
  return { category, format: "", title: rest.trim(), note: "" };
}

/** 公式の「分類」を、サイト内で使う種類に寄せる（絞り込みやアイコン分けに使う） */
function toKind(category, format) {
  const c = category.toUpperCase();
  if (c.includes("BLU-RAY") || c.includes("DVD")) return "live-video";
  if (c === "ALBUM" || c === "EP" || /album/i.test(format)) return "album";
  if (c === "配信") return "single";
  return "other"; // 書簡型小説・画集など
}

const items = [];

for (let page = 1; page <= 20; page++) {
  const res = await fetch(`${BASE}/discography/?page=${page}`, {
    headers: { "User-Agent": "Mozilla/5.0 (yorushika-fan data fetch)" },
  });
  if (!res.ok) throw new Error(`page ${page}: HTTP ${res.status}`);
  const html = await res.text();

  // 1作品 = <a href="/discography/detail/78/"> 〜 </a> のまとまり
  const blocks = [
    ...html.matchAll(/<a href="\/discography\/detail\/(\d+)\/"[\s\S]*?<\/a>/g),
  ];
  if (blocks.length === 0) break; // ページが尽きたら終わり

  for (const [block, id] of blocks) {
    const artist = block.match(/class="category">([^<]+)</)?.[1];
    const rawTitle = block.match(/class="tit"><span><span>([^<]+)</)?.[1];
    const date = block.match(/(\d{4})\.(\d{2})\.(\d{2}) RELEASE/);
    if (!artist || !rawTitle || !date) {
      console.warn(`読み取れなかった作品があります: detail/${id}`);
      continue;
    }

    const parsed = parseTitle(decode(rawTitle));
    items.push({
      id: Number(id),
      artist: decode(artist).trim(), // ヨルシカ / suis / n-buna
      kind: toKind(parsed.category, parsed.format),
      category: parsed.category,
      format: parsed.format,
      title: parsed.title,
      note: parsed.note,
      releaseDate: `${date[1]}-${date[2]}-${date[3]}`, // ISO形式にそろえる
      officialUrl: `${BASE}/discography/detail/${id}/`,
    });
  }

  console.log(`page ${page}: ${blocks.length}件`);
  await sleep(800);
}

// 新しい順に並べて保存する
items.sort((a, b) => b.releaseDate.localeCompare(a.releaseDate) || b.id - a.id);

fs.mkdirSync("data", { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(items, null, 2) + "\n");
console.log(`\n${items.length}件を ${OUT} に保存しました`);
