// サイト全体で使う定数。

// サイト名。ここ1か所を変えれば、全ページのタイトルと表示が変わる。
// 検索から来る人のために「ヨルシカ」という語をそのまま入れ、
// 公式と誤解されないよう「非公式」を付けている
export const SITE_NAME = "ヨルシカ非公式まとめ";

// 公開URL。sitemap や正式URL（canonical）のように、
// 「どのドメインのページか」を検索エンジンに伝える場面で絶対URLが要る
export const SITE_URL = "https://yorushika.sukinote.com";

// 公式サイトと誤解されないよう、全ページのフッターに出す注意書き
export const DISCLAIMER =
  "本サイトはファンが個人で運営する非公式サイトです。楽曲・映像・画像の権利は各権利者に帰属します。";

export const OFFICIAL_SITE = "https://yorushika.com/";

/**
 * Turnstile（ボット避け）の公開してよい側のキー。みんなの写真の投稿画面で使う。
 * 本番のキーが無いあいだは空にして、投稿欄を「準備中」にする（テスト用のキーは必ず通るので、本番では使わない）。
 * 開発サーバーでは Cloudflare 公式のテスト用キー（必ず「人間」と判定される）を使う
 */
export const TURNSTILE_SITE_KEY =
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ??
  (process.env.NODE_ENV === "development" ? "1x00000000000000000000AA" : "");
