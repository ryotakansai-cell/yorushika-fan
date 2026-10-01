import { createClient } from "@libsql/client";

/**
 * Turso（ニュース・トレンド用のDB）への接続。
 *
 * 作品・MVのデータはJSONなのでDBを使わない。DBを使うのは、
 * 1時間ごとに集めて貯めていく「変わる情報」（ニュース・note・トレンド）だけ。
 * 接続情報はサーバー側でしか使わず、閲覧者のブラウザには渡らない。
 */
export function getDbClient() {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url || !authToken) {
    throw new Error("TURSO_DATABASE_URL / TURSO_AUTH_TOKEN が未設定です");
  }
  return createClient({ url, authToken });
}
