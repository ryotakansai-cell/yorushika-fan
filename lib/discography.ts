// 作品（ディスコグラフィー）のデータを扱う。
//
// データ本体は data/discography.json。公式サイトから
// scripts/fetch-discography.mjs で取得したもので、手では書かない。
// ページはビルド時にこのJSONを読んで静的に作るので、DBもAPIも要らない。
import raw from "@/data/discography.json";

export type WorkKind = "album" | "single" | "live-video" | "other";

export type Work = {
  id: number; // 公式サイトの作品番号（detail/78 の 78）
  artist: string; // ヨルシカ / suis / n-buna
  kind: WorkKind;
  category: string; // 公式の分類表記（ALBUM、配信、Blu-ray & DVD など）
  format: string; // 3rd Full Album、Digital Single など
  title: string;
  note: string; // 「（フジファブリック原曲カバー）」のような補足
  releaseDate: string; // YYYY-MM-DD
  officialUrl: string;
};

// JSONを読み込むと型は「推測された形」になるので、上で定義した Work として扱う
export const works = raw as Work[];

export const KIND_LABEL: Record<WorkKind, string> = {
  album: "アルバム",
  single: "シングル",
  "live-video": "ライブ映像",
  other: "書籍・画集",
};

/** ヨルシカ名義の作品だけ（メンバーのソロ作品を除く） */
export const yorushikaWorks = works.filter((w) => w.artist === "ヨルシカ");

/** メンバーのソロ作品（suis / n-buna） */
export const soloWorks = works.filter((w) => w.artist !== "ヨルシカ");

/** 表示用の日付。2026-04-22 → 2026.04.22（公式サイトと同じ書き方） */
export function formatDate(iso: string) {
  return iso.replaceAll("-", ".");
}

/** 曲名から、その曲が出たシングルを探す（MVのページから作品へ繋ぐため） */
export function findSingle(songTitle: string) {
  return yorushikaWorks.find(
    (w) => w.kind === "single" && w.title === songTitle,
  );
}
