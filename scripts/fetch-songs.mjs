// 公式サイトの歌詞コーナー（LYRICS）から、ヨルシカの曲の一覧を作って data/songs.json に保存する。
//
// 曲ごとのページ（/songs/<id>）の元になる。歌詞コーナーは「作品の一覧 → 作品ごとの収録曲 →
// 曲ごとの歌詞ページ」の作りで、曲ごとに番号（/lyrics/detail/75/ の 75）が振られている。
// シングルとアルバムの両方に入っている曲も同じ番号なので、これを曲のIDにする
// （曲名をIDにすると、記号や表記の揺れでURLが壊れたり変わったりするため）。
//
// 取得するのは「曲名・番号・収録作品と曲順」という事実の情報だけ。歌詞は取得しない
// （歌詞は公式の歌詞ページへリンクする。このサイトの約束）。
//
// 歌の無い曲（『エルマ』の「車窓」など）は歌詞コーナーに載っていないので、ここには入らない。
//
// 使い方: npm run fetch:songs
// GitHub Actions（.github/workflows/refresh-data.yml）でも毎日自動で実行される。
import { safeWriteJson } from "./lib/safe-write.mjs";

const BASE = "https://yorushika.com";
const OUT = "data/songs.json";
const UA = "Mozilla/5.0 (yorushika-fan data fetch)";

// 公式サイトに負荷をかけないよう、1ページごとに少し待つ
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** HTMLの文字参照（&amp; など）を普通の文字に戻す */
function decode(s) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .trim();
}

async function get(url) {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  return res.text();
}

// ① 作品の一覧（歌詞コーナーの作品ごとのページの番号と、作品名）
const releases = [];
for (let page = 1; page <= 20; page++) {
  const html = await get(`${BASE}/discography/artist/2/?page=${page}`);
  const found = [
    ...html.matchAll(
      /<a href="\/discography\/artist\/2\/detail\/(\d+)\/">[\s\S]*?class="tit"><span><span>([^<]+)</g,
    ),
  ];
  if (found.length === 0) break; // ページが尽きたら終わり
  for (const [, id, title] of found) {
    releases.push({ id: Number(id), title: decode(title) });
  }
  console.log(`作品の一覧 page ${page}: ${found.length}件`);
  await sleep(800);
}

// ② 作品ごとの収録曲。同じ曲（同じ番号）は1つにまとめ、どの作品の何曲目かを足していく
const songs = new Map();
for (const r of releases) {
  const html = await get(`${BASE}/discography/artist/2/detail/${r.id}/`);
  const tracks = [
    ...html.matchAll(
      /<a href="\/lyrics\/detail\/(\d+)\/">\s*<div class="track_num">(\d+)\.?<\/div>\s*<div class="track_title">([^<]+)</g,
    ),
  ];
  if (tracks.length === 0)
    console.warn(`収録曲を読み取れなかった作品: ${r.title}`);
  for (const [, id, num, title] of tracks) {
    const song = songs.get(Number(id)) ?? {
      id: Number(id),
      title: decode(title),
      lyricsUrl: `${BASE}/lyrics/detail/${id}/`,
      releases: [],
    };
    // num は歌詞コーナーでの並び順（歌の無い曲を除いた順）。アルバムの本当の曲順ではないので表示には使わない
    song.releases.push({ release: r.title, order: Number(num) });
    songs.set(song.id, song);
  }
  console.log(`${r.title}: ${tracks.length}曲`);
  await sleep(800);
}

// 番号の大きい順（だいたい新しい曲が先）に並べて保存する。前回より大きく減っていたら保存せずに止まる
safeWriteJson(
  OUT,
  [...songs.values()].sort((a, b) => b.id - a.id),
);
console.log(`${songs.size}曲を保存しました`);
