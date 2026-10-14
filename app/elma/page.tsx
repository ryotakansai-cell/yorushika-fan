import type { Metadata } from "next";
import Link from "next/link";
import { ElmaJourney, type JourneyEntry } from "@/components/ElmaJourney";
import { ELMA_DIARY_URL, diary, findSongByTitle } from "@/lib/songs";

export const metadata: Metadata = {
  alternates: { canonical: "/elma" },
  title: "エルマの旅",
  description:
    "ヨルシカ『エルマ』の日記を日付順にたどり、エルマがスウェーデンのどこで、どの曲を書いたかを地図で追えるページ。",
};

// エルマの日記（公式サイトで公開）を、日付順の年表と地図で追うページ。
// 日記の文章は写さず、日付・場所・その日に書かれた曲・出来事を自分の言葉で1行にまとめている（CLAUDE.md の線引き）。
// 日記の内容は data/elma-diary.json。曲ページの「エルマの日記で」と同じデータを使う
export default function ElmaPage() {
  // 地図の部品はブラウザで動くので、渡すのは表示に要るものだけ（JSON をまるごと送らない）
  const entries: JourneyEntry[] = diary.map((d) => ({
    date: d.date,
    town: d.town,
    summary: d.summary,
    songs: d.songs.map((title) => {
      const song = findSongByTitle(title);
      return { title, href: song ? `/songs/${song.id}` : undefined };
    }),
    pt: d.pt,
    precision: d.precision,
    spotHref: d.spot ? `/map/${d.spot}` : undefined,
    photo: d.photo,
  }));

  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-10">
      <h1 className="font-serif text-2xl text-ink">エルマの旅</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        ヨルシカのアルバム『エルマ』は、エルマが手紙に残されたエイミーの足跡をたどってスウェーデンを旅しながら書いた、という物語の作品です。
        その旅の日記が
        <a
          href={ELMA_DIARY_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-ink transition hover:text-accent"
        >
          公式サイト
        </a>
        で公開されています。日記を日付順にたどると、アルバムの曲がどこで書かれたかが分かります。
      </p>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        下へ読み進めると、地図がその日の場所へ動きます。日記の内容は短くまとめたものなので、全文はぜひ公式サイトで読んでください。
        ジャケット写真の場所は
        <Link href="/map" className="text-ink transition hover:text-accent">
          聖地巡礼マップ
        </Link>
        （スウェーデン）にも載せています。
      </p>

      <div className="mt-8">
        <ElmaJourney entries={entries} />
      </div>
    </main>
  );
}
