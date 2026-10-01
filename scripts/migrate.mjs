// データベースの表を作る（既にあれば何もしない）。
//
// 使い方: npm run db:migrate
//
// CREATE TABLE IF NOT EXISTS にしているので、何度実行しても安全。
// 表の形を変えたくなったら、ここに ALTER TABLE を足していく。
import { createClient } from "@libsql/client";

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

await db.batch(
  [
    // 集めた記事。本文は保存しない（キーワードだけ別の表に抜き出す）
    `CREATE TABLE IF NOT EXISTS articles (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      url            TEXT NOT NULL UNIQUE,  -- 同じ記事を二重に保存しないための目印
      source         TEXT NOT NULL,         -- google_news / note / hatena / reddit / youtube
      category       TEXT NOT NULL,         -- news / official / fan / overseas / topic
      title          TEXT NOT NULL,
      publisher      TEXT,                  -- 媒体名、または書いた人
      published_at   TEXT NOT NULL,         -- 公開日時（ISO形式・UTC）
      fetched_at     TEXT NOT NULL,         -- 最初に取得した日時
      bookmark_count INTEGER,               -- はてなブックマーク数（はてブ由来のみ）
      like_count     INTEGER,               -- noteの7日間スキ数（あとで記録する）
      like_checked_at TEXT,                 -- スキ数を確認した日時
      removed_at     TEXT                   -- 元の記事が消えていた・除外した日時
    )`,
    `CREATE INDEX IF NOT EXISTS idx_articles_published
       ON articles (published_at DESC)`,

    // 記事から抜き出したキーワード（急上昇ワード用）
    `CREATE TABLE IF NOT EXISTS article_keywords (
      article_id INTEGER NOT NULL,
      keyword    TEXT NOT NULL,
      kind       TEXT NOT NULL,             -- work（曲名など） / word（一般の言葉）
      PRIMARY KEY (article_id, keyword)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_keywords_keyword
       ON article_keywords (keyword)`,

    // Wikipedia「ヨルシカ」の日別閲覧数（世間の関心度）
    `CREATE TABLE IF NOT EXISTS wiki_pageviews (
      date  TEXT PRIMARY KEY,               -- YYYY-MM-DD
      views INTEGER NOT NULL
    )`,
  ],
  "write",
);

// ---- 列の追加（ALTER TABLE は「既にあれば何もしない」が書けないので、有無を見てから足す）----

async function addColumn(table, column, type) {
  const cols = (await db.execute(`PRAGMA table_info(${table})`)).rows.map(
    (r) => r.name,
  );
  if (cols.includes(column)) return false;
  await db.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
  console.log(`列を追加: ${table}.${column}`);
  return true;
}

// Bluesky への自動投稿の状態（lib/news/bluesky.ts）
const addedBsky = await addColumn("articles", "bsky_status", "TEXT");
await addColumn("articles", "bsky_note", "TEXT"); // 対象外・失敗の理由
await addColumn("articles", "bsky_uri", "TEXT"); // 投稿のID（削除するときに使う）
await addColumn("articles", "bsky_at", "TEXT"); // 状態を記録した日時
if (addedBsky) {
  // 仕組みを入れる前からあった記事は投稿しない。
  // 印を付けないと、動かした瞬間に直近48時間ぶんの記事が流れてしまう
  const r = await db.execute(
    "UPDATE articles SET bsky_status = 'backfill' WHERE bsky_status IS NULL",
  );
  console.log(`既存の記事 ${r.rowsAffected}件 を「投稿しない」にした`);
}

const tables = await db.execute(
  "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
);
console.log(
  "テーブル:",
  tables.rows.map((r) => r.name).filter((n) => !n.startsWith("sqlite_")),
);
