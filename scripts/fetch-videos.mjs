// 公式YouTubeチャンネルの全動画を取得して data/videos.json に保存する。
//
// 動画そのものは保存しない。保存するのは「動画ID・タイトル・公開日・再生数・長さ」
// だけで、サイトでは公式の埋め込み（YouTubeが許可している仕組み）で見せる。
//
// 消費: playlistItems.list 1ユニット/50件 ＋ videos.list 1ユニット/50件
//       300本あっても十数ユニットで済む
//
// 使い方: npm run fetch:videos
// GitHub Actions（.github/workflows/refresh-data.yml）でも毎日自動で実行される。
// そのときのキーは GitHub の Secrets（YOUTUBE_API_KEY）から渡される。
import { safeWriteJson } from "./lib/safe-write.mjs";

// 公式サイトのフッターにある公式YouTubeチャンネル
const CHANNEL_ID = "UCRIgIJQWuBJ0Cv_VlU3USNA";
const OUT = "data/videos.json";
const API = "https://www.googleapis.com/youtube/v3";

const apiKey = process.env.YOUTUBE_API_KEY;
if (!apiKey) {
  console.error("YOUTUBE_API_KEY が読み込めませんでした。");
  process.exit(1);
}

async function get(path, params) {
  const qs = new URLSearchParams({ ...params, key: apiKey });
  const res = await fetch(`${API}/${path}?${qs}`);
  const json = await res.json();
  if (json.error) throw new Error(`${path}: ${json.error.message}`);
  return json;
}

// ① アップロード済み動画の一覧。チャンネルIDの先頭 UC を UU に変えると
//    「そのチャンネルのアップロード動画」の再生リストIDになる
const uploads = [];
let pageToken;
do {
  const json = await get("playlistItems", {
    part: "snippet",
    playlistId: `UU${CHANNEL_ID.slice(2)}`,
    maxResults: "50",
    ...(pageToken ? { pageToken } : {}),
  });
  for (const item of json.items ?? []) {
    uploads.push({
      videoId: item.snippet.resourceId.videoId,
      title: item.snippet.title,
      publishedAt: item.snippet.publishedAt,
    });
  }
  pageToken = json.nextPageToken;
} while (pageToken);

// ② 再生数と長さをまとめて取る（50件ずつ）
const stats = new Map();
for (let i = 0; i < uploads.length; i += 50) {
  const ids = uploads.slice(i, i + 50).map((u) => u.videoId);
  const json = await get("videos", {
    part: "statistics,contentDetails",
    id: ids.join(","),
  });
  for (const v of json.items ?? []) {
    stats.set(v.id, {
      viewCount: Number(v.statistics?.viewCount ?? 0),
      duration: v.contentDetails?.duration ?? "", // ISO 8601（PT4M12S など）
    });
  }
}

const videos = uploads
  .map((u) => ({ ...u, ...(stats.get(u.videoId) ?? {}) }))
  // 非公開・削除済みで統計が取れなかったものは除く
  .filter((v) => v.viewCount !== undefined)
  .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));

// 前回より大きく減っていたら保存せずに止まる
safeWriteJson(OUT, videos);
