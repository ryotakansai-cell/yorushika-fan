import type { Metadata } from "next";
import { OFFICIAL_LINKS } from "@/lib/links";

export const metadata: Metadata = {
  title: "公式リンク集",
  description:
    "ヨルシカの公式サイト・YouTube・X・Instagram・TikTok・グッズなど、公式サイトに掲載されているリンクをまとめています。",
};

export default function LinksPage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-10">
      <h1 className="font-serif text-2xl text-ink">公式リンク集</h1>
      <p className="mt-2 text-sm text-muted">
        公式サイト（yorushika.com）から辿れるものだけを載せています。
        似た名前のなりすましアカウントに気をつけてください。
      </p>

      {OFFICIAL_LINKS.map((group) => (
        <section key={group.title} className="mt-10">
          <h2 className="font-serif text-lg text-ink">{group.title}</h2>
          <ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {group.links.map((l) => (
              <li key={l.url}>
                <a
                  href={l.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group block rounded-lg border border-line bg-card px-4 py-3 transition hover:border-accent"
                >
                  <span className="font-serif text-ink transition group-hover:text-accent">
                    {l.label}
                  </span>
                  {l.description && (
                    <span className="mt-0.5 block text-xs text-muted">
                      {l.description}
                    </span>
                  )}
                  {/* どこへ飛ぶのかを事前に分かるようにドメインを見せる */}
                  <span className="mt-1 block truncate text-[11px] text-muted/80">
                    {new URL(l.url).hostname}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}
