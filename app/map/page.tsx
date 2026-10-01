import type { Metadata } from "next";
import { PilgrimageMap } from "@/components/PilgrimageMap";
import { getSpots } from "@/lib/map";

export const metadata: Metadata = {
  alternates: { canonical: "/map" },
  title: "聖地巡礼マップ",
  description:
    "ヨルシカのライブ会場や展示・コラボの開催場所を地図にまとめています。すべて公式の告知を出典にしています。",
};

// 展示の「開催中・終了」は今日の日付で決まるので、1日1回作り直す。
// データ自体は JSON なので、アクセスのたびに作り直す必要はない
export const revalidate = 86400;

export default function MapPage() {
  const spots = getSpots();
  const liveCount = spots.filter((s) => s.category === "live").length;
  const eventCount = spots.length - liveCount;

  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-10">
      <h1 className="font-serif text-2xl text-ink">聖地巡礼マップ</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        ライブ会場 {liveCount} か所と、展示・コラボの開催場所 {eventCount}{" "}
        か所を載せています。いずれも公式の告知を出典にしていて、各行のタイトルから元の告知を開けます。
        作品の舞台やファンによる推定の場所は、出典を確かめてから順次追加します。
      </p>

      {/* 巡礼する人へのお願い。地元に迷惑がかかるとファン全体の印象が悪くなる */}
      <div className="mt-6 rounded-lg border border-line bg-card px-4 py-3 text-sm leading-relaxed text-muted">
        <p className="text-ink">訪れる前に</p>
        <ul className="mt-1 list-disc space-y-0.5 pl-5">
          <li>終了した展示は、会場に行っても見られません。</li>
          <li>
            ライブ会場は公演の無い日は閉まっていることがあります。敷地内での撮影は各施設のルールに従ってください。
          </li>
          <li>近隣の住民や他の利用者の迷惑にならないようにしましょう。</li>
        </ul>
      </div>

      <div className="mt-8">
        <PilgrimageMap spots={spots} />
      </div>
    </main>
  );
}
