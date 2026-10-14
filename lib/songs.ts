// 曲ごとのページ（/songs/<id>）のためのデータ。
//
// 曲の一覧は data/songs.json（公式サイトの歌詞コーナーから scripts/fetch-songs.mjs で取得）。
// 曲のIDは公式の歌詞ページの番号（/lyrics/detail/75/ の 75）。
// ここで、曲と「収録作品・映像・聖地・エルマの日記」を曲名でつなぐ。
// つなぎ方をここに集めておけば、クイズやカードなど後から作る機能も同じつながりを使える。
import diaryJson from "@/data/elma-diary.json";
import songsJson from "@/data/songs.json";
import { yorushikaWorks, type Work } from "@/lib/discography";
import { getScenesForWork } from "@/lib/map";
import { videos, type Video } from "@/lib/videos";

type RawSong = {
  id: number;
  title: string;
  lyricsUrl: string;
  /** release は歌詞コーナーでの作品名（「2nd Full Album「エルマ」」）。order は表示しない（本当の曲順ではない） */
  releases: { release: string; order: number }[];
};

export type DiaryEntry = {
  date: string;
  town: string;
  summary: string;
  songs: string[];
  /** 公式サイトの日記の何枚目か */
  slide: number;
  pt?: [number, number];
  /**
   * 位置の確かさ。spot＝日記の記述から場所が特定できる / town＝街のどこか（街の中心に置く） /
   * area＝日記からは特定できない範囲（8/27・9/8 の浜。ヴィスビーの北の海岸のどこか）
   */
  precision?: "spot" | "town" | "area";
  /** 聖地巡礼マップに載っている場所なら、その id（見比べ画面へつなぐ） */
  spot?: string;
  /** オーナーが現地の様子と照らし合わせて確かめた */
  verified?: boolean;
};

export const ELMA_DIARY_URL = "https://yorushika.com/feature/elma";

export const diary = diaryJson as DiaryEntry[];

export type Song = RawSong & {
  /** 収録作品（公式のディスコグラフィーの作品。発売の古い順） */
  works: Work[];
};

/**
 * 歌詞コーナーの作品名（「3rd Full Album「盗作」」）から、公式のディスコグラフィーの作品を探す。
 * 作品名だけで探すと、同じ名前の別作品（2026年のライブ映像『ヨルシカ LIVE「盗作」』など）を拾ってしまった。
 * そこで「」の前の種類（3rd Full Album / Digital Single / EP …）が、format か category と一致するものを選ぶ
 */
function findWork(release: string) {
  const m = release.match(/^(.*?)\s*「(.+)」/);
  const kind = m?.[1].trim() ?? "";
  const title = m?.[2] ?? release;
  const same = yorushikaWorks.filter((w) => w.title === title);
  return (
    same.find(
      (w) => kind !== "" && (w.format === kind || w.category === kind),
    ) ??
    // 種類で決まらなければ、ライブ映像以外を選ぶ（曲が最初に収録されるのは音源のほう）
    same.find((w) => w.kind !== "live-video")
  );
}

export const songs: Song[] = (songsJson as RawSong[]).map((s) => ({
  ...s,
  works: s.releases
    .map((r) => findWork(r.release))
    .filter((w): w is Work => Boolean(w))
    .sort((a, b) => a.releaseDate.localeCompare(b.releaseDate)),
}));

export function findSong(id: number) {
  return songs.find((s) => s.id === id);
}

/** 曲名から曲ページを探す（MVページから「この曲のページ」へつなぐため） */
export function findSongByTitle(title: string) {
  return songs.find((s) => s.title === title);
}

/**
 * その曲の映像（MV・ライブ映像）。動画の「名前」（タイトルから飾りを取ったもの）で照らし合わせる。
 * ライブ映像は「花人局 / 春泥棒」のように2曲入りのことがあるので、「 / 」で分けて比べる
 */
export function videosForSong(title: string): Video[] {
  return videos.filter(
    (v) =>
      (v.kind === "mv" || v.kind === "live") &&
      v.name.split(/\s*\/\s*/).includes(title),
  );
}

/** エルマの日記で、その曲が書かれた日 */
export function diaryForSong(title: string) {
  return diary.filter((d) => d.songs.includes(title));
}

export function scenesForSong(title: string) {
  return getScenesForWork(title);
}

/** 一覧の並び: 最初に出た作品の発売日が新しい順。作品が分からない曲は最後 */
export function songsByFirstRelease() {
  return [...songs].sort((a, b) =>
    (b.works[0]?.releaseDate ?? "").localeCompare(
      a.works[0]?.releaseDate ?? "",
    ),
  );
}
