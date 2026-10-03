// マップのカードに使う写真の候補を Wikimedia Commons から集め、選ぶための確認ページを作る。
//
// なぜ Commons か:
// - Googleマップに一般の人が上げた写真は投稿者に著作権があり、こちらで保存して使えない
// - Googleのストリートビュー画像APIは、クレジットカード登録が必須で、見られるほど請求が増える
// - Commons の写真は自由ライセンス（CC BY / CC BY-SA など）で、撮影者名とライセンスを
//   表示すれば使える。地点の近くで撮られた写真を位置情報で探せる
//
// 近くで撮られた写真には、マンホールや看板など関係ないものも混ざるので、自動では選ばない。
// 確認ページ（design/photo-review.html）を開いて、人が1か所1枚を選ぶ。
//
// 使い方: node scripts/commons-candidates.mjs
import fs from "node:fs";

const UA = "yorushika-fan/1.0 (+https://yorushika-fan.vercel.app)";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const PER_SPOT = 8;
const RADIUS = 300; // m。広げると無関係な写真が増える

const scenes = JSON.parse(fs.readFileSync("data/scenes.json", "utf8"));

/** HTMLタグを外す（撮影者名が <a> 付きで返ってくることがあるため） */
const stripTags = (s) => (s ?? "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

async function candidates(lat, lon) {
  const url =
    "https://commons.wikimedia.org/w/api.php?" +
    new URLSearchParams({
      action: "query",
      format: "json",
      generator: "geosearch",
      ggscoord: `${lat}|${lon}`,
      ggsradius: String(RADIUS),
      ggsnamespace: "6", // ファイル（画像）だけ
      ggslimit: "30",
      prop: "imageinfo|coordinates",
      iiprop: "url|extmetadata|mime",
      iiurlwidth: "480", // 一覧のカード用の縮小版
    });
  const json = await (await fetch(url, { headers: { "User-Agent": UA } })).json();
  const pages = Object.values(json.query?.pages ?? {});
  return pages
    .map((p) => {
      const ii = p.imageinfo?.[0];
      const meta = ii?.extmetadata ?? {};
      const c = p.coordinates?.[0];
      const dist = c ? Math.hypot((c.lat - lat) * 111000, (c.lon - lon) * 91000) : 9999;
      return {
        title: p.title,
        mime: ii?.mime,
        thumb: ii?.thumburl,
        page: ii?.descriptionurl,
        license: stripTags(meta.LicenseShortName?.value),
        artist: stripTags(meta.Artist?.value).slice(0, 80),
        dist: Math.round(dist),
      };
    })
    // 写真だけ（図・地図・音声などを外す）。ライセンスが分からないものは使えないので外す
    .filter((x) => /jpeg|png|webp/.test(x.mime ?? "") && x.thumb && x.license)
    .sort((a, b) => a.dist - b.dist)
    .slice(0, PER_SPOT);
}

const out = [];
for (const s of scenes) {
  const list = await candidates(s.lat, s.lon);
  out.push({ id: s.id, name: s.name, list });
  console.log(`${s.name}: ${list.length}枚`);
  await sleep(400);
}
fs.mkdirSync("design", { recursive: true });
fs.writeFileSync("design/photo-candidates.json", JSON.stringify(out, null, 2) + "\n");

// 確認ページ。番号（例: 登窯広場 3）を伝えてもらえば、その写真をデータに登録する
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const html = `<!doctype html><meta charset="utf-8"><title>写真の候補</title>
<style>
body{font-family:sans-serif;background:#f7f5f0;color:#262626;margin:24px}
h2{margin:32px 0 8px;font-size:18px} .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px}
figure{margin:0;background:#fffdf8;border:1px solid #e3ded3;border-radius:8px;overflow:hidden}
img{width:100%;aspect-ratio:4/3;object-fit:cover;display:block}
figcaption{padding:6px 8px;font-size:12px;color:#6f6a60} b{color:#262626;font-size:14px}
</style>
<h1>マップのカードに使う写真の候補（Wikimedia Commons）</h1>
<p>使いたい写真の番号を「場所名 番号」で教えてください（例: 登窯広場 3）。どれも合わなければ「なし」で大丈夫です（MVのサムネイルで代わりにします）。</p>
${out
  .map(
    (s) => `<h2>${esc(s.name)}（${s.list.length}枚）</h2><div class="grid">${
      s.list.length === 0
        ? "<p>近くに写真がありませんでした</p>"
        : s.list
            .map(
              (x, i) => `<figure><a href="${esc(x.page)}" target="_blank"><img src="${esc(x.thumb)}" loading="lazy"></a>
<figcaption><b>${i + 1}</b>　約${x.dist}m・${esc(x.license)}<br>${esc(x.artist)}</figcaption></figure>`,
            )
            .join("")
    }</div>`,
  )
  .join("")}`;
fs.writeFileSync("design/photo-review.html", html);
console.log("design/photo-review.html を作りました");
