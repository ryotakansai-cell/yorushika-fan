// 集めた記事のうち新しいものを、Bluesky のボット用アカウントに自動投稿する。
// 毎時の収集（/api/cron/collect）の最後に呼ばれる。
//
// 何を投稿するか（2026-10-01 に実データで決めた）:
// - 公式・ニュースは投稿する（見出しにヨルシカ関連の言葉がある記事だけが集まっている）
// - note は「見出しで」ヨルシカの話と分かるものだけ。本文で触れているだけの日記や、
//   別のバンドの考察がすり抜けていた（直近15件中1〜2件）。サイトには載せるが投稿はしない
// - 海外（Reddit・英語）と話題（はてブ。古い記事が混ざる）は投稿しない
//
// 流しすぎないための決まり:
// - 1回（1時間）に最大 MAX_PER_RUN 件。残りは次の回に回す
// - 公開から MAX_AGE_HOURS 時間以内の記事だけ。後から見つかった古い記事は流さない
// - 同じニュースを複数の媒体が報じたときは、似た見出しを1回だけ投稿する（/news のまとめ方と同じ基準）
//
// 投稿の状態は articles.bsky_status に記録する:
//   NULL      … まだ判断していない
//   posted    … 投稿した（bsky_uri に投稿のIDが入る。削除依頼が来たらこれで消せる）
//   skipped   … 投稿の対象外（bsky_note に理由）
//   backfill  … 仕組みを入れる前からあった記事。投稿しない
//   error     … 投稿に失敗した（bsky_note に内容）
//
// API は公式の XRPC を fetch で直接呼ぶ（呼ぶのは3種類だけなので、ライブラリは入れない）。
import { getDbClient } from "@/lib/db";
import { mentionsWorkInBrackets } from "./dictionary";
import { RELATED } from "./filter";
import type { Category, Source } from "./sources";
import {
  CATEGORY_LABEL,
  SAME_STORY,
  SAME_STORY_DAYS,
  normalize,
  similarity,
} from "./view";

const MAX_PER_RUN = 3;
const MAX_AGE_HOURS = 48;
const HASHTAG = "ヨルシカ";
// ログインはどのアカウントでもこの入口で受け付けてくれる。
// 投稿はアカウントが実際に置かれているサーバー（PDS）に送る（ログイン結果から分かる）
const ENTRYWAY = "https://bsky.social";

type Candidate = {
  id: number;
  url: string;
  source: Source;
  category: Category;
  title: string;
  publisher: string | null;
  publishedAt: string;
};

export type BlueskyReport = {
  /** 認証情報が登録されていて、実際に投稿したか */
  enabled: boolean;
  posted: { title: string; uri?: string }[];
  skipped: { title: string; reason: string }[];
  errors: { title: string; error: string }[];
  /** 確認用（preview）のときだけ: 登録された認証情報でログインできたか */
  login?: "ok" | "認証情報が未登録" | string;
  /** ログインに失敗したときの、値を出さない形のチェック */
  credentialCheck?: Record<string, boolean>;
};

/** 投稿してよい記事か。だめなら理由を返す */
function skipReason(a: Candidate): string | null {
  switch (a.category) {
    case "official":
    case "news":
      return null;
    case "fan":
      return RELATED.test(a.title) || mentionsWorkInBrackets(a.title)
        ? null
        : "noteの見出しからヨルシカの話と分からない";
    case "overseas":
      return "海外（英語）は投稿しない";
    case "topic":
      return "話題（はてブ）は投稿しない";
  }
}

/** 投稿の本文。Bluesky は300文字（書記素）まで */
function buildText(a: Candidate) {
  const label = `【${CATEGORY_LABEL[a.category]}】`;
  // note は書いた人の名前を出す（記事を紹介する以上、誰の記事かを明示する）
  const by = a.publisher ? `\n${a.publisher}` : "";
  const tag = `\n#${HASHTAG}`;
  const budget = 300 - graphemes(label + by + tag) - 1;
  const title =
    graphemes(a.title) > budget
      ? [...segment(a.title)].slice(0, budget - 1).join("") + "…"
      : a.title;
  return { text: `${label}${title}${by}${tag}`, tag };
}

function* segment(s: string) {
  for (const { segment } of new Intl.Segmenter("ja", {
    granularity: "grapheme",
  }).segment(s)) {
    yield segment;
  }
}
const graphemes = (s: string) => [...segment(s)].length;

/**
 * ハッシュタグを「押せるタグ」にするための印（facet）。
 * 位置は文字数ではなく UTF-8 のバイト数で指定する決まり（日本語は1文字3バイト）
 */
function tagFacet(text: string, tag: string) {
  const enc = new TextEncoder();
  const start = enc.encode(text.slice(0, text.lastIndexOf(tag) + 1)).length;
  const end = start + enc.encode(tag.slice(2)).length + 1; // 「\n」を除いた「#ヨルシカ」
  return {
    index: { byteStart: start, byteEnd: end },
    features: [{ $type: "app.bsky.richtext.facet#tag", tag: HASHTAG }],
  };
}

type Session = { accessJwt: string; did: string; pds: string };

async function login(identifier: string, password: string): Promise<Session> {
  const res = await fetch(`${ENTRYWAY}/xrpc/com.atproto.server.createSession`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier, password }),
  });
  if (!res.ok)
    throw new Error(`ログインに失敗: ${res.status} ${await res.text()}`);
  const json = await res.json();
  const pds =
    json.didDoc?.service?.find((s: { id: string }) => s.id === "#atproto_pds")
      ?.serviceEndpoint ?? ENTRYWAY;
  return { accessJwt: json.accessJwt, did: json.did, pds };
}

async function createPost(session: Session, a: Candidate) {
  const { text, tag } = buildText(a);
  const record = {
    $type: "app.bsky.feed.post",
    text,
    langs: ["ja"],
    createdAt: new Date().toISOString(),
    facets: [tagFacet(text, tag)],
    // 元の記事へのリンクカード。読む人がこのサイトを経由せず直接記事へ行けるようにする。
    // サムネイル画像は付けない（他人の記事の画像をこちらでアップロードし直すことになるため）
    embed: {
      $type: "app.bsky.embed.external",
      external: { uri: a.url, title: a.title, description: a.publisher ?? "" },
    },
  };
  const res = await fetch(`${session.pds}/xrpc/com.atproto.repo.createRecord`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.accessJwt}`,
    },
    body: JSON.stringify({
      repo: session.did,
      collection: "app.bsky.feed.post",
      record,
    }),
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return String((await res.json()).uri);
}

/**
 * 新しい記事を投稿する。
 * preview=true のときは何も投稿・記録せず、「投稿するならこれ」を返すだけ（確認用）
 */
export async function postNewArticles(
  preview: boolean,
): Promise<BlueskyReport> {
  // コピーのときに付きやすい「先頭の @」と「前後の空白・改行」は取り除く
  const handle = process.env.BLUESKY_HANDLE?.trim().replace(/^@/, "");
  const password = process.env.BLUESKY_APP_PASSWORD?.trim();
  const enabled = Boolean(handle && password) && !preview;
  const report: BlueskyReport = {
    enabled,
    posted: [],
    skipped: [],
    errors: [],
  };

  const db = getDbClient();
  const since = new Date(
    Date.now() - MAX_AGE_HOURS * 3600 * 1000,
  ).toISOString();
  const rows = (
    await db.execute({
      sql: `
        SELECT id, url, source, category, title, publisher, published_at
        FROM articles
        WHERE bsky_status IS NULL AND removed_at IS NULL AND published_at >= ?
        ORDER BY published_at ASC
      `,
      args: [since],
    })
  ).rows;
  const candidates: Candidate[] = rows.map((r) => ({
    id: Number(r.id),
    url: String(r.url),
    source: r.source as Source,
    category: r.category as Category,
    title: String(r.title),
    publisher: r.publisher === null ? null : String(r.publisher),
    publishedAt: String(r.published_at),
  }));

  // 直近に投稿した見出し。同じニュースの言い換えを二重に投稿しないために比べる
  const recentPosted = (
    await db.execute({
      sql: `SELECT title FROM articles WHERE bsky_status = 'posted' AND published_at >= ?`,
      args: [
        new Date(Date.now() - SAME_STORY_DAYS * 24 * 3600 * 1000).toISOString(),
      ],
    })
  ).rows.map((r) => normalize(String(r.title)));

  const toPost: Candidate[] = [];
  const marks: { id: number; status: string; note?: string; uri?: string }[] =
    [];

  for (const a of candidates) {
    const reason =
      skipReason(a) ??
      ([...recentPosted, ...toPost.map((p) => normalize(p.title))].some(
        (t) => similarity(t, normalize(a.title)) >= SAME_STORY,
      )
        ? "同じニュースを投稿済み"
        : null);
    if (reason) {
      report.skipped.push({ title: a.title, reason });
      marks.push({ id: a.id, status: "skipped", note: reason });
      continue;
    }
    // 上限を超えた分は何も記録せず、次の回に回す
    if (toPost.length < MAX_PER_RUN) toPost.push(a);
  }

  if (!enabled) {
    // 確認用: 投稿予定を返すだけで、DBには何も書かない
    report.posted = toPost.map((a) => ({ title: buildText(a).text }));
    // 認証情報があればログインだけ試す。パスワードの写し間違いを、
    // 最初の本番投稿で初めて知るのではなく、ここで見つけるため（投稿はしない）
    if (handle && password) {
      try {
        await login(handle, password);
        report.login = "ok";
      } catch (e) {
        report.login = String(e).slice(0, 200);
        // 失敗したときは、値そのものは出さずに「形」だけ確かめて返す
        const raw = process.env.BLUESKY_APP_PASSWORD ?? "";
        report.credentialCheck = {
          handleHadAt:
            process.env.BLUESKY_HANDLE?.trim().startsWith("@") ?? false,
          handleEndsWithBskySocial: handle.endsWith(".bsky.social"),
          passwordHadSpaces: raw !== raw.trim(),
          // アプリパスワードは「xxxx-xxxx-xxxx-xxxx」の形（英小文字と数字）
          passwordLooksLikeAppPassword: /^[a-z0-9]{4}(-[a-z0-9]{4}){3}$/.test(
            password,
          ),
        };
      }
    } else {
      report.login = "認証情報が未登録";
    }
    return report;
  }

  if (toPost.length > 0) {
    try {
      const session = await login(handle!, password!);
      for (const a of toPost) {
        try {
          const uri = await createPost(session, a);
          report.posted.push({ title: a.title, uri });
          marks.push({ id: a.id, status: "posted", uri });
        } catch (e) {
          report.errors.push({ title: a.title, error: String(e) });
          marks.push({
            id: a.id,
            status: "error",
            note: String(e).slice(0, 300),
          });
        }
      }
    } catch (e) {
      // ログインできないときは記録を残さない（パスワードを直せば次の回に投稿される）
      report.errors.push({ title: "(ログイン)", error: String(e) });
    }
  }

  if (marks.length > 0) {
    const now = new Date().toISOString();
    await db.batch(
      marks.map((m) => ({
        sql: `UPDATE articles SET bsky_status = ?, bsky_note = ?, bsky_uri = ?, bsky_at = ? WHERE id = ?`,
        args: [m.status, m.note ?? null, m.uri ?? null, now, m.id],
      })),
      "write",
    );
  }
  return report;
}
