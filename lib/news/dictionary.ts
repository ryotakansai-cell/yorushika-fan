// ヨルシカの作品名（曲名・アルバム名・ライブ名）の一覧。
//
// 手で書かず、既にある data/ のJSON（公式から取得したもの）から作る。
// 新曲が出て data/ を更新すれば、ここも自動で増える。
//
// 使い道は2つ:
// - ニュースの関連判定（見出しにヨルシカの文字が無くても、曲名で判定する）
// - 急上昇ワード（今週いちばん語られている曲）
import { works } from "@/lib/discography";
import { videos } from "@/lib/videos";

function collectTitles() {
  const names = new Set<string>();

  for (const w of works) {
    if (w.artist === "ヨルシカ") names.add(w.title);
  }
  for (const v of videos) {
    // ライブ名は「花人局 / 春泥棒」のように複数の曲が入っていることがある
    for (const part of v.name.split(/\s*\/\s*/)) {
      if (part) names.add(part);
    }
  }
  return [...names];
}

/** 作品名の一覧（重複なし） */
export const WORK_TITLES = collectTitles();

/**
 * 関連判定に使う作品名。3文字以上のものだけ。
 * 「太陽」「へび」「茜」のような短い曲名は普通の言葉と区別できないので外す
 */
const DISTINCT_TITLES = WORK_TITLES.filter((t) => [...t].length >= 3);

/**
 * 見出しに、かぎかっこで囲まれたヨルシカの曲名があるか。
 * 『忘れてください』「手を叩け」のように囲まれていれば、作品として
 * 言及している可能性が高い（地の文の「忘れてください」とは区別できる）
 */
export function mentionsWorkInBrackets(title: string) {
  return DISTINCT_TITLES.some(
    (t) => title.includes(`「${t}」`) || title.includes(`『${t}』`),
  );
}
