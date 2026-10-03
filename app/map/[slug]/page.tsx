import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SceneDetail } from "@/components/SceneDetail";
import { getSceneDetail, sceneIds } from "@/lib/map";

// 見比べ画面の単独ページ。URL を直接開いたとき（共有・検索から来たとき・再読み込み）に出る。
// 「夜行 聖地」のような検索から直接来てもらえるよう、場所ごとにページを持たせている
export function generateStaticParams() {
  return sceneIds().map((slug) => ({ slug }));
}

// 上で列挙していない場所の URL は 404 にする
export const dynamicParams = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const d = getSceneDetail(slug);
  if (!d) return { title: "見つかりません" };
  const works = [...new Set(d.scenes.map((s) => `「${s.work}」`))].join("");
  return {
    title: `${d.name}（ヨルシカ${works}の聖地）`,
    description: `ヨルシカ${works}のMVの舞台、${d.prefecture}の${d.name}。MVの場面と現地の様子を見比べられます。`,
    alternates: { canonical: `/map/${d.id}` },
  };
}

export default async function ScenePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const detail = getSceneDetail(slug);
  if (!detail) notFound();
  return (
    <main className="mx-auto w-full max-w-4xl px-5 py-10">
      <SceneDetail detail={detail} />
    </main>
  );
}
