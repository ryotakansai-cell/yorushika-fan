import type { Metadata } from "next";
import {
  KIND_LABEL,
  formatDate,
  soloWorks,
  yorushikaWorks,
  type Work,
  type WorkKind,
} from "@/lib/discography";

export const metadata: Metadata = {
  alternates: { canonical: "/discography" },
  title: "作品一覧（ディスコグラフィー）",
  description:
    "ヨルシカのアルバム・シングル・ライブ映像・書籍を発売日順にまとめた一覧。各作品は公式サイトの詳細ページへ移動できます。",
};

// 表示する順番。アルバムが一番探されるので先頭に
const ORDER: WorkKind[] = ["album", "single", "live-video", "other"];

/** 作品1件の行。タイトルを押すと公式サイトの作品ページへ */
function WorkRow({ work, showArtist }: { work: Work; showArtist?: boolean }) {
  return (
    <li>
      <a
        href={work.officialUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="group flex flex-wrap items-baseline gap-x-4 gap-y-1 py-3"
      >
        <span className="w-24 shrink-0 text-sm tabular-nums text-muted">
          {formatDate(work.releaseDate)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="font-serif text-ink transition group-hover:text-accent">
            {work.title}
          </span>
          {/* 3rd Full Album / Digital Single などの公式の表記を小さく添える */}
          {(work.format || work.note || showArtist) && (
            <span className="ml-2 text-xs text-muted">
              {[showArtist ? work.artist : "", work.format, work.note]
                .filter(Boolean)
                .join(" ・ ")}
            </span>
          )}
        </span>
      </a>
    </li>
  );
}

export default function DiscographyPage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-10">
      <h1 className="font-serif text-2xl text-ink">作品一覧</h1>
      <p className="mt-2 text-sm text-muted">
        公式サイトのディスコグラフィーをもとに、種類ごと・発売日の新しい順に並べています。
        タイトルを押すと公式サイトの作品ページ（収録曲など）が開きます。
      </p>

      {/* 目次。種類ごとの見出しへページ内で移動する */}
      <nav className="mt-6 flex flex-wrap gap-2 text-sm">
        {ORDER.map((kind) => (
          <a
            key={kind}
            href={`#${kind}`}
            className="rounded-full border border-line bg-card px-3 py-1 text-ink transition hover:border-accent hover:text-accent"
          >
            {KIND_LABEL[kind]}
          </a>
        ))}
        <a
          href="#solo"
          className="rounded-full border border-line bg-card px-3 py-1 text-ink transition hover:border-accent hover:text-accent"
        >
          メンバーのソロ作品
        </a>
      </nav>

      {ORDER.map((kind) => {
        const list = yorushikaWorks.filter((w) => w.kind === kind);
        if (list.length === 0) return null;
        return (
          // scroll-mt はページ内リンクで飛んだとき、見出しが画面上端に貼り付かないための余白
          <section key={kind} id={kind} className="mt-10 scroll-mt-6">
            <h2 className="font-serif text-lg text-ink">
              {KIND_LABEL[kind]}
              <span className="ml-2 text-sm text-muted">{list.length}</span>
            </h2>
            <ul className="mt-3 divide-y divide-line border-y border-line">
              {list.map((w) => (
                <WorkRow key={w.id} work={w} />
              ))}
            </ul>
          </section>
        );
      })}

      <section id="solo" className="mt-10 scroll-mt-6">
        <h2 className="font-serif text-lg text-ink">
          メンバーのソロ作品
          <span className="ml-2 text-sm text-muted">{soloWorks.length}</span>
        </h2>
        <p className="mt-1 text-xs text-muted">
          suis（ボーカル）と n-buna（コンポーザー）の個人名義の作品です。
        </p>
        <ul className="mt-3 divide-y divide-line border-y border-line">
          {soloWorks.map((w) => (
            <WorkRow key={w.id} work={w} showArtist />
          ))}
        </ul>
      </section>
    </main>
  );
}
