// みんなの写真（ファンが投稿した聖地の写真）のサーバー側の処理。
//
// 方針（CLAUDE.md「体験型の機能とファンの投稿」。オーナーの判断）:
// - 承認制にしない。投稿したらすぐ公開し、問題があれば後から消す（事後対応）
// - 守りは仕組みで持つ: Turnstile でボットを弾く / 写真の位置情報（EXIF）を消す /
//   1日の投稿数に上限 / 通報が REPORTS_TO_HIDE 件たまったら自動で非表示 / 投稿した人はいつでも消せる
//
// 写真は R2（バケット yorushika-photos。wrangler.jsonc の PHOTOS）に置き、
// 「どの聖地の、どの写真か」と投稿の情報は Turso の photos 表に入れる。
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDbClient } from "@/lib/db";
export { stripJpegMetadata } from "@/lib/jpeg";

export const MAX_BYTES = 3 * 1024 * 1024; // ブラウザで1600pxに縮めた JPEG なら、ふつうは1MB未満
export const MAX_SIDE = 1600;
export const MAX_COMMENT = 100;
export const MAX_NAME = 20;
const MAX_PER_DAY = 10; // 同じ人（IP）が1日に投稿できる数
const REPORTS_TO_HIDE = 3; // 別々の人からの通報がこの数になったら自動で非表示

/** R2 のうち、ここで使う機能だけの型（Cloudflare の型定義パッケージを入れていないため） */
type R2Object = {
  body: ReadableStream;
  httpEtag: string;
};
type R2Bucket = {
  put(
    key: string,
    value: Uint8Array,
    opts?: { httpMetadata?: { contentType?: string } },
  ): Promise<unknown>;
  get(key: string): Promise<R2Object | null>;
  delete(key: string): Promise<void>;
};

export function getPhotoBucket(): R2Bucket {
  const { env } = getCloudflareContext();
  const bucket = (env as unknown as { PHOTOS?: R2Bucket }).PHOTOS;
  if (!bucket) throw new Error("R2 の PHOTOS が設定されていません");
  return bucket;
}

// --------------------------------------------------------------
// ボット避け（Turnstile）
// --------------------------------------------------------------

/**
 * Turnstile の公式のテスト用の秘密鍵（必ず「人間」と判定される）。開発サーバーでだけ使う。
 * 本番は Worker の Secret（TURNSTILE_SECRET_KEY）に本物を入れる。無ければ投稿を受け付けない
 */
const TEST_SECRET = "1x0000000000000000000000000000000AA";

export async function verifyTurnstile(token: string, ip: string) {
  const secret =
    process.env.TURNSTILE_SECRET_KEY ??
    (process.env.NODE_ENV === "development" ? TEST_SECRET : undefined);
  if (!secret) return false;
  const res = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    {
      method: "POST",
      body: new URLSearchParams({ secret, response: token, remoteip: ip }),
    },
  );
  const data = (await res.json()) as { success?: boolean };
  return data.success === true;
}

// --------------------------------------------------------------
// 合言葉・IP のハッシュ
// --------------------------------------------------------------

/**
 * IP や削除の合言葉は、そのまま保存せずハッシュにする。
 * 合言葉の推測を防ぐため、秘密の値（CRON_SECRET）を混ぜてからハッシュにする
 */
export async function hash(value: string) {
  const salt = process.env.CRON_SECRET ?? "dev";
  const bytes = new TextEncoder().encode(`${salt}:${value}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** 投稿した人のブラウザにだけ渡す、削除の合言葉 */
export function newDeleteToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function clientIp(headers: Headers) {
  return (
    headers.get("cf-connecting-ip") ??
    headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    "local"
  );
}

// --------------------------------------------------------------
// DB
// --------------------------------------------------------------

export type FanPhoto = {
  id: number;
  url: string;
  width: number;
  height: number;
  comment: string | null;
  name: string | null;
  takenMonth: string | null;
  createdAt: string;
};

export async function listPhotos(spotId: string): Promise<FanPhoto[]> {
  const rows = (
    await getDbClient().execute({
      sql: `SELECT id, r2_key, width, height, comment, name, taken_month, created_at
            FROM photos WHERE spot_id = ? AND hidden_at IS NULL
            ORDER BY created_at DESC LIMIT 60`,
      args: [spotId],
    })
  ).rows;
  return rows.map((r) => ({
    id: Number(r.id),
    url: `/api/photos/file/${String(r.r2_key)}`,
    width: Number(r.width),
    height: Number(r.height),
    comment: r.comment === null ? null : String(r.comment),
    name: r.name === null ? null : String(r.name),
    takenMonth: r.taken_month === null ? null : String(r.taken_month),
    createdAt: String(r.created_at),
  }));
}

/** 同じ人（IP）の直近24時間の投稿数が上限を超えていないか */
export async function canPostToday(ipHash: string) {
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const r = await getDbClient().execute({
    sql: "SELECT COUNT(*) AS n FROM photos WHERE ip_hash = ? AND created_at >= ?",
    args: [ipHash, since],
  });
  return Number(r.rows[0].n) < MAX_PER_DAY;
}

export async function insertPhoto(p: {
  spotId: string;
  key: string;
  width: number;
  height: number;
  comment: string | null;
  name: string | null;
  takenMonth: string | null;
  deleteHash: string;
  ipHash: string;
}) {
  const r = await getDbClient().execute({
    sql: `INSERT INTO photos
            (spot_id, r2_key, width, height, comment, name, taken_month, created_at, delete_hash, ip_hash)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      p.spotId,
      p.key,
      p.width,
      p.height,
      p.comment,
      p.name,
      p.takenMonth,
      new Date().toISOString(),
      p.deleteHash,
      p.ipHash,
    ],
  });
  return Number(r.lastInsertRowid);
}

/** 通報。同じ人の2回目以降は数えない。別々の人からの通報がたまったら非表示にする */
export async function reportPhoto(id: number, ipHash: string) {
  const db = getDbClient();
  const now = new Date().toISOString();
  const r = await db.execute({
    sql: "INSERT OR IGNORE INTO photo_reports (photo_id, ip_hash, created_at) VALUES (?, ?, ?)",
    args: [id, ipHash, now],
  });
  if (r.rowsAffected === 0) return;
  await db.execute({
    sql: `UPDATE photos SET reports = reports + 1,
            hidden_at = CASE WHEN reports + 1 >= ? THEN ? ELSE hidden_at END
          WHERE id = ?`,
    args: [REPORTS_TO_HIDE, now, id],
  });
}

/** 投稿した人が消す。合言葉が合えば、R2 の写真ごと消す */
export async function deletePhotoByOwner(id: number, token: string) {
  const db = getDbClient();
  const r = await db.execute({
    sql: "SELECT r2_key, delete_hash FROM photos WHERE id = ?",
    args: [id],
  });
  const row = r.rows[0];
  if (!row || String(row.delete_hash) !== (await hash(token))) return false;
  await getPhotoBucket().delete(String(row.r2_key));
  await db.execute({ sql: "DELETE FROM photos WHERE id = ?", args: [id] });
  await db.execute({
    sql: "DELETE FROM photo_reports WHERE photo_id = ?",
    args: [id],
  });
  return true;
}
