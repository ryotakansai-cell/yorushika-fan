// ニュース・ブログ・noteなどの情報源から記事を集める。
//
// どの情報源も「公式に配布されているRSS」だけを使う。
// note の内部API（/api/*）や検索（/search）は robots.txt で
// 機械の利用が禁止されているので使わない。
//
// それぞれの情報源は形がバラバラ（RSS 2.0 / RSS 1.0 / Atom）なので、
// ここで全部 CollectedItem という同じ形にそろえてから返す。
import { XMLParser } from "fast-xml-parser";

export type Source = "google_news" | "note" | "hatena" | "reddit" | "youtube";

/** 一覧のタブ分けに使う区分 */
export type Category = "news" | "official" | "fan" | "overseas" | "topic";

export type CollectedItem = {
  url: string;
  title: string;
  publisher: string | null; // 媒体名、または書いた人
  publishedAt: string; // ISO形式（UTC）
  source: Source;
  category: Category;
  bookmarkCount: number | null;
  /** 本文の抜粋。キーワードを抜き出すためだけに使い、DBには保存しない */
  text: string;
};

const QUERY = "ヨルシカ";
const OFFICIAL_YOUTUBE_CHANNEL = "UCRIgIJQWuBJ0Cv_VlU3USNA";

// Redditなどは、名乗らないアクセスを弾くことがあるので、何者かを明示する
const USER_AGENT =
  "yorushika-fan/1.0 (+https://yorushika.sukinote.com; non-commercial fan site)";

// 1件しかないときに配列ではなくオブジェクトになるのを防ぐため、
// 記事にあたる要素は常に配列として読む
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  isArray: (name) => name === "item" || name === "entry",
});

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * XMLを取得して読み込む。
 * retries を指定すると、失敗したときに少し待ってやり直す。
 * 公式YouTubeのRSSは、同じURLでも 200 / 404 / 500 がランダムに返る
 * 不安定さがあった（実測）ので、YouTubeだけやり直しを付けている。
 * 429（アクセスしすぎ）のときは、やり直すとさらに嫌われるので諦める。
 */
async function fetchXml(url: string, retries = 0) {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      cache: "no-store",
    });
    if (res.ok) return parser.parse(await res.text());
    if (res.status === 429 || attempt >= retries) {
      throw new Error(`HTTP ${res.status}: ${url}`);
    }
    await sleep(1500 * (attempt + 1));
  }
}

/**
 * 数字で書かれた文字（&#x30E8; や &#12354; のような「数値文字参照」）を元の文字に戻す。
 * はてなブックマークのRSSは見出しが全部この形で届くので、戻さないと
 * 「&#x30E8;&#x30EB;…」のまま表示され、ヨルシカ関連かどうかの判定もできない
 */
function decodeNumericEntities(s: string) {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) =>
      String.fromCodePoint(parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)));
}

/** RSSの中の要素は「ただの文字列」のことも「{#text: ...}」のこともあるので、文字列にそろえる */
function text(v: unknown): string {
  let s = "";
  if (typeof v === "string" || typeof v === "number") s = String(v);
  else if (v && typeof v === "object" && "#text" in v) s = String(v["#text"]);
  return decodeNumericEntities(s);
}

/** HTMLタグを取り除いて、キーワード抽出用の素の文章にする */
function stripHtml(html: string) {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** いろいろな日付の書き方（RFC822 / ISO）を、ISO形式（UTC）にそろえる */
function toIso(v: string) {
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

// ---------------------------------------------------------------
// Googleニュース（RSS 2.0）
// 主要な音楽メディアや公式サイトのお知らせをまとめて拾える
// ---------------------------------------------------------------
export async function fromGoogleNews(): Promise<CollectedItem[]> {
  const q = encodeURIComponent(QUERY);
  const xml = await fetchXml(
    `https://news.google.com/rss/search?q=${q}&hl=ja&gl=JP&ceid=JP:ja`,
  );

  return (xml.rss?.channel?.item ?? []).map((it: Record<string, unknown>) => {
    const publisher = text(it.source) || null;
    const sourceUrl = (it.source as { "@_url"?: string } | undefined)?.[
      "@_url"
    ];
    // 見出しの末尾に「 - 媒体名」が付いているので取り除く
    let title = text(it.title);
    if (publisher && title.endsWith(` - ${publisher}`)) {
      title = title.slice(0, -(publisher.length + 3));
    }
    // 公式サイトとレーベル（ユニバーサル ミュージック）の発表は「公式」として分ける
    const isOfficial = /yorushika\.com|universal-music\.co\.jp/.test(
      sourceUrl ?? "",
    );
    return {
      url: text(it.link),
      title,
      publisher,
      publishedAt: toIso(text(it.pubDate)),
      source: "google_news",
      category: isOfficial ? "official" : "news",
      bookmarkCount: null,
      text: title, // Googleニュースは本文を配らないので見出しだけ
    };
  });
}

// ---------------------------------------------------------------
// note（RSS 2.0）。#ヨルシカ のハッシュタグが付いた投稿
// ---------------------------------------------------------------
export async function fromNote(): Promise<CollectedItem[]> {
  const tag = encodeURIComponent(QUERY);
  const xml = await fetchXml(`https://note.com/hashtag/${tag}/rss`);

  return (xml.rss?.channel?.item ?? []).map((it: Record<string, unknown>) => ({
    url: text(it.link),
    title: text(it.title),
    publisher: text(it["note:creatorName"]) || null,
    publishedAt: toIso(text(it.pubDate)),
    source: "note" as const,
    category: "fan" as const,
    bookmarkCount: null,
    text: `${text(it.title)} ${stripHtml(text(it.description))}`,
  }));
}

// ---------------------------------------------------------------
// はてなブックマーク（RSS 1.0）。話題になった記事とブックマーク数
// ---------------------------------------------------------------
export async function fromHatena(): Promise<CollectedItem[]> {
  const q = encodeURIComponent(QUERY);
  const xml = await fetchXml(
    `https://b.hatena.ne.jp/q/${q}?target=all&sort=recent&mode=rss`,
  );

  return (xml["rdf:RDF"]?.item ?? []).map((it: Record<string, unknown>) => {
    const url = text(it.link);
    return {
      url,
      title: text(it.title),
      // はてブには媒体名が無いので、記事のドメインを媒体名代わりにする
      publisher: url ? new URL(url).hostname.replace(/^www\./, "") : null,
      publishedAt: toIso(text(it["dc:date"])),
      source: "hatena" as const,
      category: "topic" as const,
      bookmarkCount: Number(text(it["hatena:bookmarkcount"])) || 0,
      text: `${text(it.title)} ${stripHtml(text(it.description))}`,
    };
  });
}

// ---------------------------------------------------------------
// Reddit r/Yorushika（Atom）。海外ファンの投稿
// ---------------------------------------------------------------
export async function fromReddit(): Promise<CollectedItem[]> {
  const xml = await fetchXml("https://www.reddit.com/r/Yorushika/new/.rss");

  return (xml.feed?.entry ?? []).map((it: Record<string, unknown>) => {
    const link = it.link as { "@_href"?: string } | undefined;
    const author = it.author as { name?: string } | undefined;
    return {
      url: link?.["@_href"] ?? "",
      title: text(it.title),
      publisher: author?.name
        ? String(author.name).replace(/^\/u\//, "")
        : null,
      publishedAt: toIso(text(it.published) || text(it.updated)),
      source: "reddit" as const,
      category: "overseas" as const,
      bookmarkCount: null,
      text: `${text(it.title)} ${stripHtml(text(it.content))}`,
    };
  });
}

// ---------------------------------------------------------------
// 公式YouTube（Atom）。APIキーを使わないので、YouTubeの1日の枠を消費しない
// ---------------------------------------------------------------
export async function fromYouTube(): Promise<CollectedItem[]> {
  const xml = await fetchXml(
    `https://www.youtube.com/feeds/videos.xml?channel_id=${OFFICIAL_YOUTUBE_CHANNEL}`,
    2, // 不安定なので最大2回やり直す
  );

  return (
    (xml.feed?.entry ?? [])
      .map((it: Record<string, unknown>) => {
        const link = it.link as { "@_href"?: string } | undefined;
        return {
          url: link?.["@_href"] ?? "",
          title: text(it.title),
          publisher: "ヨルシカ公式YouTube",
          publishedAt: toIso(text(it.published)),
          source: "youtube" as const,
          category: "official" as const,
          bookmarkCount: null,
          text: text(it.title),
        };
      })
      // 宣伝用のショート動画はURLが /shorts/ になっているので除く
      .filter((it: CollectedItem) => !it.url.includes("/shorts/"))
  );
}

export const SOURCES: Record<Source, () => Promise<CollectedItem[]>> = {
  google_news: fromGoogleNews,
  note: fromNote,
  hatena: fromHatena,
  reddit: fromReddit,
  youtube: fromYouTube,
};
