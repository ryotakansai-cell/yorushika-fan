import type { Metadata } from "next";
import { Noto_Serif_JP } from "next/font/google";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next";
import { SiteHeader } from "@/components/SiteHeader";
import { DISCLAIMER, OFFICIAL_SITE, SITE_NAME, SITE_URL } from "@/lib/site";

// 見出し用の明朝体。next/font はフォントを自分のサーバーから配信するので、
// Googleへの通信が発生せず、表示のガタつき（レイアウトのずれ）も防げる
const serif = Noto_Serif_JP({
  weight: ["400", "600"],
  subsets: ["latin"],
  variable: "--font-serif-jp",
  display: "swap",
});

export const metadata: Metadata = {
  // これを決めておくと、各ページで "/mv" のような相対パスを書いても
  // canonical（正式URL）などが絶対URLに展開される
  metadataBase: new URL(SITE_URL),

  // 各ページは title だけ返せば「〇〇 | サイト名」になる
  title: {
    default: `${SITE_NAME} | 作品・MV・公式リンク`,
    template: `%s | ${SITE_NAME}`,
  },
  description:
    "ヨルシカの作品一覧・MV・ライブ映像・公式リンクをまとめた非公式ファンサイト。",
  // canonical（正式URL）はここには書かない。レイアウトの設定は全ページに
  // 引き継がれるので、ここで "/" にすると全ページが「正式にはトップページ」と
  // 宣言してしまい、検索結果から個別ページが消える。各ページで自分のURLを書く
  // XなどでURLを貼ったときのカードに使われる情報
  openGraph: {
    siteName: SITE_NAME,
    locale: "ja_JP",
    type: "website",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ja" className={`${serif.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <SiteHeader />
        <div className="flex-1">{children}</div>

        {/* 公式サイトと誤解されないよう、全ページに注意書きを出す */}
        <footer className="border-t border-line">
          <div className="mx-auto w-full max-w-5xl px-5 py-8 text-xs leading-relaxed text-muted">
            <p>{DISCLAIMER}</p>
            <p className="mt-2">
              最新の正確な情報は
              <a
                href={OFFICIAL_SITE}
                target="_blank"
                rel="noopener noreferrer"
                className="mx-1 text-ink underline underline-offset-2 transition hover:text-accent"
              >
                ヨルシカ公式サイト
              </a>
              をご確認ください。
            </p>
          </div>
        </footer>

        {/* どのページが見られているかを測る（Vercelの管理画面で有効化が必要） */}
        <Analytics />
      </body>
    </html>
  );
}
