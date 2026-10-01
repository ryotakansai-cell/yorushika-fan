// 集めた記事のうち、残すものと捨てるものを決める。
//
// 「ヨルシカ」で検索しても、本文で一言触れただけの記事（秋アニメ一覧など）が
// 混ざるので、ニュースとはてブは見出しにヨルシカ関連の言葉があるものだけ残す。
//
// 公式（公式サイト・レーベル・公式YouTube）は無条件で残す。公式サイトの
// お知らせは自分のサイトの記事なので見出しに「ヨルシカ」が入っていない
// （「二人称展」を東京・大阪で開催。など）。最初はこれを落としてしまっていた。
//
// note は #ヨルシカ のタグだけ付けた無関係な日記（「2026年9月」など）が
// 混ざるので、見出しか本文の抜粋に一度でも出てくるものだけ残す。
// 実データ25件で確かめたところ、関係のある投稿はほぼすべてこれで残り、
// 日記はほぼすべて落ちた。
// 「一人称」「盗作」などの作品名は判定に使わない（「一人称視点」のような
// 普通の言葉と区別できないため）。
//
// Reddit は場所そのものがヨルシカ専用なので全部残す。
import { mentionsWorkInBrackets } from "./dictionary";
import type { CollectedItem } from "./sources";

// \bsuis\b にしているのは、英語の文章中の別の単語に誤って当たらないようにするため
export const RELATED = /ヨルシカ|yorushika|n-buna|ナブナ|\bsuis\b/i;

// 載せないでほしいと言われた記事や、誹謗中傷の記事を外すための除外リスト。
// URLの完全一致と、ドメイン単位の両方で指定できる
const BLOCKED_URLS: string[] = [];
const BLOCKED_DOMAINS: string[] = [];

export function isBlocked(url: string) {
  if (BLOCKED_URLS.includes(url)) return true;
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return BLOCKED_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`));
  } catch {
    return true; // URLとして読めないものは載せない
  }
}

// Googleニュースは、誰でも投稿できる場所（YouTube など）の一般の投稿も拾うことがある。
// 2026-10-01 にファンのヲタ芸動画が「ニュース」として入ったので、媒体名で外す。
// 公式YouTubeの動画は別の情報源（youtube）から公式として集めているので、ここで外しても困らない
const UGC_PUBLISHERS =
  /^(YouTube|TikTok|X|Twitter|Instagram|ニコニコ動画|niconico)$/i;

export function isRelevant(item: CollectedItem) {
  if (!item.url || !item.title) return false;
  if (isBlocked(item.url)) return false;
  if (item.category === "official") return true;

  switch (item.source) {
    case "google_news":
      return (
        RELATED.test(item.title) && !UGC_PUBLISHERS.test(item.publisher ?? "")
      );
    case "hatena":
      return RELATED.test(item.title);
    case "note":
      return (
        RELATED.test(item.title) ||
        RELATED.test(item.text) ||
        // 『忘れてください』のように曲名をかぎかっこで囲んでいる考察記事
        // （「ヨルシカ」の文字が無くても明らかにヨルシカの記事）を拾うため
        mentionsWorkInBrackets(item.title)
      );
    case "reddit":
    case "youtube":
      return true;
  }
}

/** 同じ記事を別のURLで二重に保存しないよう、追跡用のパラメータなどを取り除く */
export function normalizeUrl(url: string) {
  try {
    const u = new URL(url);
    u.hash = "";
    for (const key of [...u.searchParams.keys()]) {
      if (key.startsWith("utm_") || key === "ref" || key === "fbclid") {
        u.searchParams.delete(key);
      }
    }
    return u.toString();
  } catch {
    return url;
  }
}
