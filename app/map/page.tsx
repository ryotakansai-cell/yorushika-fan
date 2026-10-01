import type { Metadata } from "next";
import { PilgrimageMap } from "@/components/PilgrimageMap";
import { getSpots } from "@/lib/map";

export const metadata: Metadata = {
  alternates: { canonical: "/map" },
  title: "聖地巡礼マップ",
  description:
    "ヨルシカのMVの舞台、ライブ会場、展示・コラボの開催場所を地図にまとめています。MVの場面から再生して、ストリートビューと見比べられます。",
};

// 展示の「開催中・終了」は今日の日付で決まるので、1日1回作り直す。
// データ自体は JSON なので、アクセスのたびに作り直す必要はない
export const revalidate = 86400;

export default function MapPage() {
  const spots = getSpots();
  const count = (c: string) => spots.filter((s) => s.category === c).length;

  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-10">
      <h1 className="font-serif text-2xl text-ink">聖地巡礼マップ</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        MVの舞台 {count("scene")} か所、ライブ会場 {count("live")}{" "}
        か所、展示・コラボの開催場所 {count("event")} か所を載せています。
        ライブ会場と展示は公式の告知が出典です。
      </p>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        MVの舞台は、公式が場所を明言したものではありません。メディアが記事にしているものを「報道」、
        ファンや地域メディアが「モデルでは」としているものを「推定」として、出典と一緒に載せています。
        MVの題名を押すとその場面から再生されるので、「ストリートビューで見る」と見比べてみてください。
      </p>

      {/* 巡礼する人へのお願い。地元に迷惑がかかるとファン全体の印象が悪くなる */}
      <div className="mt-6 rounded-lg border border-line bg-card px-4 py-3 text-sm leading-relaxed text-muted">
        <p className="text-ink">訪れる前に</p>
        <ul className="mt-1 list-disc space-y-0.5 pl-5">
          <li>終了した展示は、会場に行っても見られません。</li>
          <li>
            駅は列車が運行しています。ホームでの撮影は、列車や他の利用者の妨げにならないようにしましょう。
          </li>
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
