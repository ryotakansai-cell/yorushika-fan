// ライブ会場の名前から緯度・経度を調べて、確認用の一覧を出す（保存はしない）。
//
// OpenStreetMap の住所検索（Nominatim）を使う。無料だが利用ルールがある:
// - 1秒に1回まで
// - 何者かを User-Agent で名乗る
// - 大量の一括検索はしない（会場は数十件なので問題ない）
//
// 名前だけで検索すると、同じ名前の別の場所に当たることがある
// （最初の版では「大阪城ホール」が松原市の「至誠ホール」に当たった）。
// そのため候補を複数もらい、名前が一致するものだけを採用する。
// 一致しなければ「要確認」として出し、人が確かめてから data/ に書く。
//
// 使い方: node scripts/geocode-venues.mjs
import fs from "node:fs";

const UA = "yorushika-fan/1.0 (+https://yorushika-fan.vercel.app)";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const performances = JSON.parse(
  fs.readFileSync("data/live-performances.json", "utf8"),
);
const venues = [...new Set(performances.map((p) => p.venue))];

// 公式の表記のままでは地図データに無い会場の、別の呼び方。
// 改名・閉館した会場もここで補う（閉館の扱いは地図に載せる段階で決める）
const ALIASES = {
  "幕張メッセ国際展示場1～8ホール・イベントホール": ["幕張メッセ"],
  "札幌文化芸術劇場 hitaru": ["札幌文化芸術劇場", "hitaru"],
  "札幌カナモトホール": ["札幌市民ホール", "カナモトホール"],
  "新木場スタジオコースト": ["STUDIO COAST", "スタジオコースト"],
  "TSUTAYA O-EAST": ["Spotify O-EAST", "O-EAST"],
  "BIG CAT": ["BIGCAT", "心斎橋BIGCAT"],
  // 地図データに未登録。所在地（千種区今池4-7-11）は data/venues.json に手で入れた
  "ボトムライン": ["名古屋ボトムライン"],
  // 地図データ上は「大阪城 ホール」と空白入りで、日本語名では別の施設に当たる
  "大阪城ホール": ["Osaka-jo Hall"],
};

/** 検索に使う語の一覧（公式表記 → 補足を外した名前 → 別名 の順に試す） */
function queries(name) {
  const base = name.replace(/\[[^\]]*\]/g, "").trim();
  const short = base
    .replace(
      /\s*(A館|B館|メインホール|こくさいホール|センチュリーホール|ホールA|劇場棟)$/,
      "",
    )
    .replace(/\s*\(.*?\)\s*/g, " ")
    .trim();
  return [...new Set([base, short, ...(ALIASES[name] ?? [])])];
}

/** 空白・大小文字・全角半角の違いを無視して比べるための形 */
const norm = (s) =>
  s
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s・\-]/g, "");

for (const name of venues) {
  let hit = null;
  let usedQuery = null;
  let fallback = null; // 名前は一致しないが、何かしら見つかったもの（要確認用）

  for (const q of queries(name)) {
    const url =
      "https://nominatim.openstreetmap.org/search?" +
      new URLSearchParams({ q, format: "json", countrycodes: "jp", limit: "5" });
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    const json = await res.json();
    await sleep(1100); // 1秒に1回のルールを守る

    // 地図上の名前（display_name の先頭）に検索語が含まれるものだけを採用する
    const match = json.find((r) =>
      norm(r.display_name.split(",")[0]).includes(norm(q)) ||
      norm(q).includes(norm(r.display_name.split(",")[0])),
    );
    if (match) {
      hit = match;
      usedQuery = q;
      break;
    }
    fallback ??= json[0] ? { r: json[0], q } : null;
  }

  if (hit) {
    console.log(
      `○ ${name}\n    → ${Number(hit.lat).toFixed(5)}, ${Number(hit.lon).toFixed(5)}  ${hit.display_name.slice(0, 70)}` +
        (usedQuery !== name ? `\n    （検索語: ${usedQuery}）` : ""),
    );
  } else if (fallback) {
    console.log(
      `△ ${name}（名前が一致しない。要確認）\n    → ${fallback.r.display_name.slice(0, 70)}\n    （検索語: ${fallback.q}）`,
    );
  } else {
    console.log(`× ${name}\n    → 見つからず`);
  }
}
