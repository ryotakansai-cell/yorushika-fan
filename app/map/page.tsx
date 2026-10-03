import type { Metadata } from "next";
import Link from "next/link";
import { PilgrimageMap } from "@/components/PilgrimageMap";
import { getSpots } from "@/lib/map";

export const metadata: Metadata = {
  alternates: { canonical: "/map" },
  title: "聖地巡礼マップ",
  description:
    "ヨルシカのMVの舞台（聖地）を地図にまとめています。MVの場面と現地の様子を並べて見比べられます。",
};

// データは JSON なので、ビルド時に一度だけ作る（展示を外したので日付で変わる表示も無くなった）

export default function MapPage() {
  const spots = getSpots();

  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-10">
      <h1 className="font-serif text-2xl text-ink">聖地巡礼マップ</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        ヨルシカのMVの舞台 {spots.length}{" "}
        か所を載せています。MVの場面と現地の写真を見比べて確かめたものを中心に、出典と一緒に載せています。
        まだ確かめられていないものには「推定」、n-bunaさんやMV監督がインタビューで触れたものには「制作者の発言」と付けています。
      </p>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        カードを押すと地図がその場所へ動き、「見比べる」でMVの場面と現地の様子を並べて見られます。
        ライブ会場や展示の開催場所は
        <Link href="/live" className="text-ink transition hover:text-accent">
          ライブ・展示の記録
        </Link>
        にまとめています。
      </p>

      {/* 巡礼する人へのお願い。地元に迷惑がかかるとファン全体の印象が悪くなる */}
      <div className="mt-6 rounded-lg border border-line bg-card px-4 py-3 text-sm leading-relaxed text-muted">
        <p className="text-ink">訪れる前に</p>
        <ul className="mt-1 list-disc space-y-0.5 pl-5">
          <li>
            駅は列車が運行しています。ホームでの撮影は、列車や他の利用者の妨げにならないようにしましょう。
          </li>
          <li>
            廃墟は崩落の危険があり、敷地に無断で入ると不法侵入になります。外から見るだけにしてください。
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
