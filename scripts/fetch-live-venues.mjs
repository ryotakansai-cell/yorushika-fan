// 公式サイトの LIVE カテゴリーの記事から、公演ごとの「日程・会場」を抜き出して
// data/live-performances.json に保存する。聖地巡礼マップの「公式に関係する場所」の元データ。
//
// 記事には次のような形で書かれている:
//   【宮城公演①】
//   日程：2026年3月21日(土)
//   会場：ゼビオアリーナ仙台（https://www.xebioarena.com/）
//
// 会場の緯度・経度はここでは決めない（別の工程で、人の確認を挟んで付ける）。
//
// 使い方: npm run fetch:live
import { safeWriteJson } from "./lib/safe-write.mjs";

const BASE = "https://yorushika.com";
const OUT = "data/live-performances.json";
const UA = "yorushika-fan/1.0 (+https://yorushika-fan.vercel.app)";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url) {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  return res.text();
}

// 年によって「大阪城ホール」「大阪・大阪城ホール」のように都道府県名が付いたり
// 付かなかったりするので、先頭の「都道府県名・」を取り除いて同じ会場として扱う
const PREFECTURE_PREFIX =
  /^(北海道|青森|岩手|宮城|秋田|山形|福島|茨城|栃木|群馬|埼玉|千葉|東京|神奈川|新潟|富山|石川|福井|山梨|長野|岐阜|静岡|愛知|三重|滋賀|京都|大阪|兵庫|奈良|和歌山|鳥取|島根|岡山|広島|山口|徳島|香川|愛媛|高知|福岡|佐賀|長崎|熊本|大分|宮崎|鹿児島|沖縄)・/;

/** HTMLを「1行1要素」の素の文章にする */
function toLines(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/g, "")
    .replace(/<style[\s\S]*?<\/style>/g, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|li|div|h\d|tr|td|th|dd|dt)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    // 「9月１日」のような全角数字を半角にそろえる。そろえないと日付として読めない
    // （2021年の神戸公演の変更後の日付がこの書き方で、最初は読み落としていた）
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    // 「◾️」の後ろに付く、絵文字の見た目を変えるための見えない文字を取り除く
    .replace(/️/g, "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

// ① LIVE カテゴリーの記事一覧（ページが尽きるまで）
const posts = [];
for (let page = 1; page <= 10; page++) {
  const html = await get(`${BASE}/news/11/?page=${page}`);
  const found = [
    ...html.matchAll(/<a href="\/news\/detail\/(\d+)\/?"[\s\S]*?<\/a>/g),
  ];
  if (found.length === 0) break;
  for (const [block, id] of found) {
    if (posts.some((p) => p.id === id)) continue;
    const title = toLines(block).join(" ");
    posts.push({ id, title });
  }
  await sleep(800);
}
console.log(`LIVEの記事: ${posts.length}件`);

// ② 各記事から「日程」と「会場」の組を抜き出す
const performances = [];
for (const post of posts) {
  const url = `${BASE}/news/detail/${post.id}`;
  const lines = toLines(await get(url));

  // 記事の題名（ページの <title> の「｜」より前）
  const name = (lines[0] ?? post.title).split("｜")[0].trim();

  // 記事の上部にある「2024.04.06SAT…」から年を取っておく。
  // 「日程：4月6日（土）」のように年が省略された記事があるため（2024年の有明アリーナ公演）
  const postYear = lines.find((l) => /^\d{4}\.\d{2}\.\d{2}/.test(l))?.slice(0, 4);

  let date = null;
  let found = 0;
  // フェスの記事は「◾️会場」の次の行に会場名がある書き方なので、見出しの行を覚えておく
  let pendingLabel = null;

  for (const line of lines) {
    // 「◾️開催日」「■会場」のように、ラベルだけの行
    const label = line.match(/^[◾■□◆●・]\s*(開催日|日程|会場)\s*$/);
    if (label) {
      pendingLabel = label[1];
      continue;
    }

    let dateText = null;
    let venueText = null;
    const d = line.match(/^(?:日程|日時|公演日|開催日)\s*[：:]\s*(.+)$/);
    const v = line.match(/^会場\s*[：:]\s*(.+)$/);
    if (d) dateText = d[1];
    else if (v) venueText = v[1];
    else if (pendingLabel === "会場") venueText = line;
    else if (pendingLabel) dateText = line;
    pendingLabel = null;

    if (dateText) {
      // 「2021年8月25日（水）→2021年9月27日（月）」のように日程が変更された場合、
      // 矢印の後ろ（変更後）が実際の日程。最後に出てくる日付を使う
      // 年は省略されていることがあるので、無ければ記事の年で補う
      const all = [...dateText.matchAll(/(?:(\d{4})年)?(\d{1,2})月(\d{1,2})日/g)];
      const last = all[all.length - 1];
      const year = last?.[1] ?? postYear;
      if (last && year) {
        date = `${year}-${last[2].padStart(2, "0")}-${last[3].padStart(2, "0")}`;
      }
      continue;
    }

    if (venueText) {
      // 会場も「グランキューブ大阪 → 神戸国際会館 こくさいホール」のように
      // 変更されていることがある。矢印の後ろ（変更後）が実際の会場
      const changed = /→/.test(venueText);
      let venue = venueText.split("→").pop().trim();

      // 会場の公式サイトのURL（「（https://…）」）を取り出して、名前からは外す
      const u = venue.match(/[（(]\s*(https?:\/\/[^）)\s]+)\s*[）)]/);
      venue = venue.replace(/[（(]\s*https?:\/\/[^）)]*[）)]/g, "").trim();

      // 「札幌カナモトホール（札幌市民ホール）」のような別名は、名前とは分けて残す
      const alias = venue.match(/[（(]([^）)]+)[）)]\s*$/);
      if (alias) venue = venue.slice(0, alias.index).trim();

      performances.push({
        live: name,
        date, // 直前に出てきた日程（無ければ null。人が確認する）
        venue: venue.replace(PREFECTURE_PREFIX, "").replace(/\s+/g, " "),
        venueAlias: alias ? alias[1].trim() : null,
        venueUrl: u ? u[1] : null,
        changed, // 日程・会場が告知後に変更されたもの（確認用の目印）
        source: url,
      });
      found++;
    }
  }
  console.log(`  ${name}: ${found}公演`);
  await sleep(800);
}

safeWriteJson(OUT, performances);
