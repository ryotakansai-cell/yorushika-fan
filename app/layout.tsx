import type { Metadata } from "next";
import { Noto_Serif_JP } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/SiteHeader";
import { DISCLAIMER, OFFICIAL_SITE, SITE_NAME } from "@/lib/site";

// 見出し用の明朝体。next/font はフォントを自分のサーバーから配信するので、
// Googleへの通信が発生せず、表示のガタつき（レイアウトのずれ）も防げる
const serif = Noto_Serif_JP({
  weight: ["400", "600"],
  subsets: ["latin"],
  variable: "--font-serif-jp",
  display: "swap",
});

export const metadata: Metadata = {
  // 各ページは title だけ返せば「〇〇 | サイト名」になる
  title: {
    default: `${SITE_NAME} | 作品・MV・公式リンク`,
    template: `%s | ${SITE_NAME}`,
  },
  description:
    "ヨルシカの作品一覧・MV・ライブ映像・公式リンクをまとめた非公式ファンサイト。",
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
      </body>
    </html>
  );
}
