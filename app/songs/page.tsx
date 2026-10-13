import type { Metadata } from "next";
import Link from "next/link";
import { formatDate } from "@/lib/discography";
import { songsByFirstRelease, videosForSong, type Song } from "@/lib/songs";

export const metadata: Metadata = {
  alternates: { canonical: "/songs" },
  title: "曲",
  description:
    "ヨルシカの全曲の一覧。曲ごとに、収録作品・MV・ライブ映像・聖地・関連ニュースをまとめています。",
};

// 曲の一覧。最初に出た作品ごとにまとめ、新しい作品が上。
// シングルで先に出てアルバムにも入った曲は、先に出たシングルの欄に入る
export default function SongsPage() {
  const groups: { title: string; date: string; songs: Song[] }[] = [];
  for (const s of songsByFirstRelease()) {
    const w = s.works[0];
    const key = w?.title ?? "その他";
    const g = groups.find((x) => x.title === key);
    if (g) g.songs.push(s);
    else groups.push({ title: key, date: w?.releaseDate ?? "", songs: [s] });
  }

  return (
    <main className="mx-auto w-full max-w-4xl px-5 py-10">
      <h1 className="font-serif text-2xl text-ink">曲</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        ヨルシカの曲 {groups.reduce((n, g) => n + g.songs.length, 0)}{" "}
        曲を、最初に発表された作品ごとに並べています。曲を押すと、収録作品・映像・聖地・ニュースをまとめたページが開きます。
        曲の一覧は公式サイトの歌詞のページをもとに、毎日自動で更新しています（歌の無い曲は含みません）。
      </p>

      {groups.map((g) => (
        <section key={g.title} className="mt-8">
          <h2 className="flex flex-wrap items-baseline gap-x-3 border-b border-line pb-2">
            <span className="font-serif text-base text-ink">{g.title}</span>
            {g.date && (
              <span className="text-xs tabular-nums text-muted">
                {formatDate(g.date)}
              </span>
            )}
          </h2>
          <ul className="mt-2 grid gap-x-6 sm:grid-cols-2">
            {g.songs.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/songs/${s.id}`}
                  className="flex items-baseline justify-between gap-3 py-1.5 text-ink transition hover:text-accent"
                >
                  <span>{s.title}</span>
                  {/* MVのある曲には印を付ける（MVから探す人が多いため） */}
                  {videosForSong(s.title).some((v) => v.kind === "mv") && (
                    <span className="shrink-0 text-xs text-muted">MV</span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}
