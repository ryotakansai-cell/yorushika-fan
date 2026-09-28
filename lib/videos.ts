// 公式YouTubeチャンネルの動画を扱う。
//
// データ本体は data/videos.json（scripts/fetch-videos.mjs で取得）。
// 取得の段階では何も判定せず、「MVかライブ映像か」の判定はここでやる。
// 判定ルールを直すたびにAPIを叩き直さなくて済むようにするため。
import raw from "@/data/videos.json";

type RawVideo = {
  videoId: string;
  title: string;
  publishedAt: string;
  viewCount: number;
  duration: string; // ISO 8601（PT4M12S など）
};

export type VideoKind = "mv" | "live" | "trailer" | "nbuna" | "other";

export type Video = RawVideo & {
  kind: VideoKind;
  seconds: number;
  /** 曲名・ライブ名など、タイトルから飾りを取った名前 */
  name: string;
};

export const VIDEO_KIND_LABEL: Record<VideoKind, string> = {
  mv: "MV",
  live: "ライブ映像",
  trailer: "アルバムトレーラー",
  nbuna: "n-buna 時代",
  other: "その他",
};

/** PT1H2M3S → 3723（秒） */
function toSeconds(iso: string) {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  return Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
}

/**
 * タイトルから種類を判定する。上から順に当てはめる。
 *
 * 公式の表記には揺れがある（OFFICIAL VIDEO / Official Video / Music Video /
 * MUSIC VIDEO、さらに「OFFCIAL」という綴り間違いまである）ので、
 * 大文字小文字を区別しない正規表現で広めに拾う。
 */
function classify(title: string): { kind: VideoKind; name: string } {
  if (/Album Trailer/i.test(title)) {
    const base = title
      .replace(/^ヨルシカ\s*-\s*/, "")
      .replace(/\s*[（(]Album Trailer[)）].*$/i, "");
    // 「二人称」 → 二人称、音楽画集「幻燈」 → 幻燈
    const name = base.match(/「(.+)」/)?.[1] ?? base;
    return { kind: "trailer", name };
  }

  // 「ヨルシカ - LIVE「レプリカント」」「ヨルシカ Live「花人局 / 春泥棒」」
  const live = title.match(/^ヨルシカ\s*-?\s*LIVE\s*(?:\d{4}\s*)?「(.+)」/i);
  if (live) return { kind: "live", name: live[1] };

  // 「ヨルシカ - 春泥棒（OFFICIAL VIDEO）」「ヨルシカ - 藍二乗 (Music Video)」
  // OFF?I?CIAL は OFFICIAL / OFICIAL / OFFCIAL（公式の綴り間違い、「茜」）のどれにも一致する
  const mv = title.match(
    /^ヨルシカ\s*-\s*(.+?)\s*[（(]\s*(?:OFF?I?CIAL VIDEO|MUSIC VIDEO)\s*[)）]/i,
  );
  if (mv) return { kind: "mv", name: mv[1].trim() };

  // ヨルシカ結成前の、n-buna（ナブナ）名義のボーカロイド曲など。
  // タイトルに【初音ミク】や英語の併記が付いているので、曲名だけにする
  if (/初音ミク|GUMI|miki|ミク|n-buna|ナブナ/i.test(title)) {
    const name = title
      .replace(/【[^】]*】/g, "") // 【初音ミク】【オリジナル】
      .replace(/\s*\/.*$/, "") // 「/ 初音ミク」「/ ナブナ」以降
      .replace(/\s+-\s+.*$/, "") // 「Silence - n-buna ft. …」
      .replace(/\s{2,}.*$/, "") // 「メリュー   HatsuneMiku …」
      .replace(/^([^\x00-\x7F].*?)\s+[\x00-\x7F]+$/, "$1") // 日本語名の後ろの英語名
      .trim();
    return { kind: "nbuna", name };
  }

  return { kind: "other", name: title };
}

/**
 * 表示対象の動画。宣伝用のショート動画は除く。
 * ショートは「60秒以下」か「タイトルにハッシュタグがある」もの
 * （61秒ちょうどの予告にもハッシュタグが付いていたため両方で見る）
 */
export const videos: Video[] = (raw as RawVideo[])
  .map((v) => {
    const seconds = toSeconds(v.duration);
    return { ...v, seconds, ...classify(v.title) };
  })
  .filter((v) => v.seconds > 60 && !v.title.includes("#"));

export function byKind(kind: VideoKind) {
  return videos.filter((v) => v.kind === kind);
}

export function findVideo(videoId: string) {
  return videos.find((v) => v.videoId === videoId);
}

/** YouTubeのサムネイル。動画IDから組み立てられるので保存しなくてよい */
export function thumbnail(videoId: string) {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

/** 1234567 → 123万（日本語の読みやすい単位） */
export function formatViews(n: number) {
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(1)}億`;
  if (n >= 10_000) return `${Math.floor(n / 10_000).toLocaleString("ja-JP")}万`;
  return n.toLocaleString("ja-JP");
}

/** 245 → 4:05 */
export function formatDuration(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = String(seconds % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

/** 2026-04-24T... → 2026.04.24 */
export function formatPublished(iso: string) {
  return iso.slice(0, 10).replaceAll("-", ".");
}
