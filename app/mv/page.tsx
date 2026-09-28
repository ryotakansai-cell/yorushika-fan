import type { Metadata } from "next";
import { VideoCard } from "@/components/VideoCard";
import { VIDEO_KIND_LABEL, byKind, type VideoKind } from "@/lib/videos";

export const metadata: Metadata = {
  title: "MV・ライブ映像一覧",
  description:
    "ヨルシカ公式YouTubeチャンネルのMV・ライブ映像・アルバムトレーラーの一覧。再生回数のランキングもあります。",
};

// 並べる順番。「その他」（短い告知映像など）は出さない
const SECTIONS: VideoKind[] = ["mv", "live", "trailer", "nbuna"];

export default function MvPage() {
  // 再生回数のランキング（MVのみ）
  const ranking = [...byKind("mv")]
    .sort((a, b) => b.viewCount - a.viewCount)
    .slice(0, 10);

  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-10">
      <h1 className="font-serif text-2xl text-ink">MV・ライブ映像</h1>
      <p className="mt-2 text-sm text-muted">
        公式YouTubeチャンネルの映像です。押すとこのサイト内で再生できます（公式の埋め込みプレーヤーを使っています）。
      </p>

      <section className="mt-10">
        <h2 className="font-serif text-lg text-ink">再生回数ランキング</h2>
        <ul className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-5">
          {ranking.map((v, i) => (
            <VideoCard key={v.videoId} video={v} rank={i + 1} />
          ))}
        </ul>
      </section>

      {SECTIONS.map((kind) => {
        // 取得したデータは新しい順に並んでいるので、そのまま使う
        const list = byKind(kind);
        if (list.length === 0) return null;
        return (
          <section key={kind} className="mt-12">
            <h2 className="font-serif text-lg text-ink">
              {VIDEO_KIND_LABEL[kind]}
              <span className="ml-2 text-sm text-muted">{list.length}</span>
            </h2>
            {kind === "nbuna" && (
              <p className="mt-1 text-xs text-muted">
                ヨルシカ結成前に、n-buna（ナブナ）がボーカロイドで発表していた曲です。
              </p>
            )}
            <ul className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-4">
              {list.map((v) => (
                <VideoCard key={v.videoId} video={v} />
              ))}
            </ul>
          </section>
        );
      })}
    </main>
  );
}
