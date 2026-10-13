// ニュース・ブログ・noteなどの情報源から記事を集める。
//
// どの情報源も「公式に配布されているRSS」だけを使う。
// 例外は公式サイトのお知らせで、RSSが無いので一覧ページのHTMLを読む（robots.txt の制限なし）。
// note の内部API（/api/*）や検索（/search）は robots.txt で
// 機械の利用が禁止されているので使わない。
//
// それぞれの情報源は形がバラバラ（RSS 2.0 / RSS 1.0 / Atom）なので、
// ここで全部 CollectedItem という同じ形にそろえてから返す。
import { XMLParser } from "fast-xml-parser";

export type Source =
  "official_site" | "google_news" | "note" | "hatena" | "reddit" | "youtube";

/**
 * 一覧のタブ分けに使う区分。
 * video は Googleニュースが拾った YouTube の一般の動画（演奏してみた など）。
 * 公式YouTubeの動画は official
 */
export type Category =
  "news" | "official" | "fan" | "video" | "overseas" | "topic";

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

/** &amp; &lt; などの名前付きの文字参照を戻す（公式サイトの見出しで使われているもの） */
function decodeNamedEntities(s: string) {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&amp;/g, "&"); // 最後に戻す。先に戻すと &amp;lt; が「<」まで戻ってしまう
}

// ---------------------------------------------------------------
// 公式サイトのお知らせ（yorushika.com/news/ の一覧ページ）
//
// Googleニュースも公式サイトの記事を配るが、全部ではない。2026-10-12 に
// 公式の最新10件と比べたら、Googleニュース経由で拾えていたのは3件だけで、
// 「サポートミュージシャンに関するお知らせ」なども落ちていた。
// 公式Xの告知も同じ内容が公式サイトに載るので、ここを読めば取りこぼさない。
// 1時間に1回、一覧の1ページ目（10件）だけ読む
// ---------------------------------------------------------------
const OFFICIAL_SITE = "https://yorushika.com";

/**
 * 一覧には日付しか無い（時刻は詳細ページにも無い）。
 * 今日の記事は「見つけた時刻」を公開時刻にする（毎時集めるので、ずれても1時間ほど）。
 * 過去の日付の記事はその日の終わり（23:59）にする。0:00 にすると、
 * 夜に出たお知らせが同じ日の朝のニュースより前に並んでしまうため。
 * 公開時刻はDBに最初に入れたときの値のまま変わらない（collect の ON CONFLICT で更新しない）
 */
function officialDateToIso(ymd: string, now = new Date()) {
  const [y, m, d] = ymd.split(".").map(Number);
  // 日本時間のその日の 23:59:59 は、UTC では同じ日の 14:59:59
  const endOfDay = Date.UTC(y, m - 1, d, 14, 59, 59);
  return new Date(Math.min(endOfDay, now.getTime())).toISOString();
}

export async function fromOfficialSite(): Promise<CollectedItem[]> {
  const url = `${OFFICIAL_SITE}/news/`;
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  const html = await res.text();

  // 1件はこの形（2026-10-12 時点）:
  // <a href="/news/detail/11836" class="clearfix">
  // <p class="date">2026.10.09<span class="category">suis</span></p>
  // <p class="tit">見出し</p></a>
  const re =
    /<a href="\/news\/detail\/(\d+)"[^>]*>\s*<p class="date">([\d.]+)<span class="category">[^<]*<\/span><\/p>\s*<p class="tit">([\s\S]*?)<\/p>/g;
  const items: CollectedItem[] = [...html.matchAll(re)].map((m) => {
    const title = decodeNamedEntities(stripHtml(m[3]));
    return {
      url: `${OFFICIAL_SITE}/news/detail/${m[1]}`,
      title,
      publisher: "ヨルシカ OFFICIAL SITE",
      publishedAt: officialDateToIso(m[2]),
      source: "official_site",
      category: "official",
      bookmarkCount: null,
      text: title,
    };
  });
  // ページは開けたのに1件も読めないのは、公式サイトの作りが変わったとき。
  // 黙って0件にすると気づけないので、失敗として収集の報告に残す
  if (items.length === 0) throw new Error(`お知らせを読み取れなかった: ${url}`);
  return items;
}

// Googleニュースは、YouTube に一般の人が上げた動画（演奏してみた など）も拾う。
// 媒体名は「YouTube」のことも「youtu.be」のこともある（2026-10-12 確認。後者が
// 除外をすり抜けて「ニュース」として並んでいた）。ニュースではないので区分を video にする
const YOUTUBE_PUBLISHERS = /^(YouTube|youtu\.be|m\.youtube\.com)$/i;

// ---------------------------------------------------------------
// Googleニュース（RSS 2.0）
// 主要な音楽メディアや公式サイトのお知らせをまとめて拾える
// ---------------------------------------------------------------
export async function fromGoogleNews(): Promise<CollectedItem[]> {
  const q = encodeURIComponent(QUERY);
  const xml = await fetchXml(
    `https://news.google.com/rss/search?q=${q}&hl=ja&gl=JP&ceid=JP:ja`,
  );

  const items: Record<string, unknown>[] = xml.rss?.channel?.item ?? [];
  return items.flatMap((it): CollectedItem[] => {
    const publisher = text(it.source) || null;
    const sourceUrl =
      (it.source as { "@_url"?: string } | undefined)?.["@_url"] ?? "";
    // 公式サイトの記事は fromOfficialSite で直接取るので、こちらでは外す
    // （残すと同じお知らせが別のURLで2件入る）
    if (/yorushika\.com/.test(sourceUrl)) return [];

    // 見出しの末尾に「 - 媒体名」が付いているので取り除く
    let title = text(it.title);
    if (publisher && title.endsWith(` - ${publisher}`)) {
      title = title.slice(0, -(publisher.length + 3));
    }
    // レーベル（ユニバーサル ミュージック）の発表は「公式」として分ける
    const category: Category = /universal-music\.co\.jp/.test(sourceUrl)
      ? "official"
      : YOUTUBE_PUBLISHERS.test(publisher ?? "") ||
          /youtube\.com|youtu\.be/.test(sourceUrl)
        ? "video"
        : "news";
    return [
      {
        url: text(it.link),
        title,
        publisher,
        publishedAt: toIso(text(it.pubDate)),
        source: "google_news",
        category,
        bookmarkCount: null,
        text: title, // Googleニュースは本文を配らないので見出しだけ
      },
    ];
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
  official_site: fromOfficialSite,
  google_news: fromGoogleNews,
  note: fromNote,
  hatena: fromHatena,
  reddit: fromReddit,
  youtube: fromYouTube,
};
