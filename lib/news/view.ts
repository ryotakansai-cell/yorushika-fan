// ニュース一覧の表示用の処理。DBから読み、同じニュースを1行にまとめ、日付で区切る。
//
// 「同じニュースかどうか」の判定は、保存するときではなく表示するときにやる。
// 基準を直すたびにDBを作り直さずに済むようにするため（動画の種類の判定と同じ考え方）。
import { getDbClient } from "@/lib/db";
import type { Category, Source } from "./sources";

export type Article = {
  id: number;
  url: string;
  source: Source;
  category: Category;
  title: string;
  publisher: string | null;
  publishedAt: string;
  bookmarkCount: number | null;
};

/** 同じニュースをまとめた1行ぶん。main が代表、others が同じ話題の他の媒体 */
export type ArticleGroup = { main: Article; others: Article[] };

export type Tab = "all" | "news" | "fan" | "overseas" | "topic";

export const TABS: { value: Tab; label: string }[] = [
  { value: "all", label: "すべて" },
  { value: "news", label: "ニュース" },
  { value: "fan", label: "ファンの投稿" },
  { value: "overseas", label: "海外" },
  { value: "topic", label: "話題" },
];

export const CATEGORY_LABEL: Record<Category, string> = {
  official: "公式",
  news: "ニュース",
  fan: "note",
  overseas: "海外",
  topic: "話題",
};

/**
 * タブごとに、どの区分の記事を出すか。
 * 「すべて」から海外（Reddit）を外しているのは、英語の投稿の割合が多く
 * （9日間で25件）、日本語のニュースや感想が埋もれて読みにくかったため。
 * 海外の投稿は「海外」タブで読める
 */
const TAB_CATEGORIES: Record<Tab, Category[]> = {
  all: ["official", "news", "fan", "topic"],
  news: ["official", "news"],
  fan: ["fan"],
  overseas: ["overseas"],
  topic: ["topic"],
};

export async function getArticles(tab: Tab, limit = 300): Promise<Article[]> {
  const db = getDbClient();
  const categories = TAB_CATEGORIES[tab];
  const placeholders = categories.map(() => "?").join(", ");

  // 「話題」タブだけはブックマーク数の多い順、それ以外は新しい順
  const order =
    tab === "topic"
      ? "bookmark_count DESC, published_at DESC"
      : "published_at DESC";

  const result = await db.execute({
    sql: `
      SELECT id, url, source, category, title, publisher, published_at, bookmark_count
      FROM articles
      WHERE removed_at IS NULL AND category IN (${placeholders})
      ORDER BY ${order}
      LIMIT ?
    `,
    args: [...categories, limit],
  });

  return result.rows.map((r) => ({
    id: Number(r.id),
    url: String(r.url),
    source: r.source as Source,
    category: r.category as Category,
    title: String(r.title),
    publisher: r.publisher === null ? null : String(r.publisher),
    publishedAt: String(r.published_at),
    bookmarkCount: r.bookmark_count === null ? null : Number(r.bookmark_count),
  }));
}

// --------------------------------------------------------------
// 同じニュースを1行にまとめる
// --------------------------------------------------------------

/** 記号と空白を落として、言い回しの違いだけを比べられるようにする */
function normalize(title: string) {
  return title
    .replace(/[\s「」『』【】（）()［］[\]、。・！？!?:：＆&\-–—〜~"'“”]/g, "")
    .toLowerCase();
}

function bigrams(s: string) {
  const out: string[] = [];
  for (let i = 0; i < s.length - 1; i++) out.push(s.slice(i, i + 2));
  return out;
}

/**
 * 2つの見出しの似ている度合い（0〜1）。共通する「2文字の組」の割合で測る（ダイス係数）。
 * 日本語は単語の区切りに空白が無いので、単語ではなく2文字ずつで比べている
 */
function similarity(a: string, b: string) {
  const A = bigrams(a);
  const B = bigrams(b);
  if (A.length === 0 || B.length === 0) return a === b ? 1 : 0;
  const pool = [...B];
  let hit = 0;
  for (const g of A) {
    const i = pool.indexOf(g);
    if (i >= 0) {
      hit++;
      pool.splice(i, 1); // 同じ組を二重に数えない
    }
  }
  // 分母は削る前の元の長さで計算する（最初これを間違えて1を超える値が出た）
  return (2 * hit) / (A.length + B.length);
}

// 実データで測った結果、3日以内なら似ている度合い0.4以上はすべて同じニュースの
// 言い換えだった（「キタニタツヤのサポート終了」を各媒体が別の見出しで報じたものなど）
const SAME_STORY = 0.4;
const SAME_STORY_DAYS = 3;
const DAY = 24 * 60 * 60 * 1000;

/**
 * ニュースと公式のお知らせのうち、同じ話題のものを1行にまとめる。
 * 比べる相手は「まとまりの代表（main）」だけにする。全員と比べると
 * A≒B、B≒C の連鎖で、本当は別の話題の A と C までまとまってしまうため
 */
export function groupSameStories(articles: Article[]): ArticleGroup[] {
  const groups: ArticleGroup[] = [];
  const isNews = (a: Article) =>
    a.category === "news" || a.category === "official";

  for (const a of articles) {
    if (!isNews(a)) {
      groups.push({ main: a, others: [] });
      continue;
    }
    const key = normalize(a.title);
    const t = new Date(a.publishedAt).getTime();
    const found = groups.find(
      (g) =>
        isNews(g.main) &&
        Math.abs(new Date(g.main.publishedAt).getTime() - t) <=
          SAME_STORY_DAYS * DAY &&
        similarity(normalize(g.main.title), key) >= SAME_STORY,
    );
    if (found) found.others.push(a);
    else groups.push({ main: a, others: [] });
  }
  return groups;
}

// --------------------------------------------------------------
// 日付ごとに区切る（日本時間で）
// --------------------------------------------------------------

const jstDate = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** 日本時間の YYYY/MM/DD（日付の区切りの判定に使う） */
function jstDay(iso: string) {
  return jstDate.format(new Date(iso));
}

/** 区切りの見出し。今日・昨日は言葉で、それ以外は「9月28日（日）」 */
export function dayLabel(iso: string, now = new Date()) {
  const d = jstDay(iso);
  if (d === jstDay(now.toISOString())) return "今日";
  if (d === jstDay(new Date(now.getTime() - DAY).toISOString())) return "昨日";
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(new Date(iso));
}

/** 日本時間の時刻（09:20） */
export function timeLabel(iso: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

/** 並び順を保ったまま、同じ日付ごとにまとめる */
export function groupByDay(groups: ArticleGroup[]) {
  const days: { label: string; items: ArticleGroup[] }[] = [];
  for (const g of groups) {
    const label = dayLabel(g.main.publishedAt);
    const last = days[days.length - 1];
    if (last && last.label === label) last.items.push(g);
    else days.push({ label, items: [g] });
  }
  return days;
}
