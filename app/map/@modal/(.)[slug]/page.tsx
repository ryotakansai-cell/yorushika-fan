import { notFound } from "next/navigation";
import { Modal } from "@/components/Modal";
import { SceneDetail } from "@/components/SceneDetail";
import { getSceneDetail } from "@/lib/map";

// 一覧から「見比べる」を押したときに、地図の上に重ねて出す見比べ画面。
// (.) は「同じ階層の [slug] へのページ移動を横取りする」という Next.js の決まり。
// ここには generateStaticParams を書かない（ドキュメントのモーダルの例にも無い）。
// 書いていたとき、開発サーバーで「/map/(.)(.)(.)(.)<id> は不正なインターセプトルート」という
// エラーが出て、外して開発サーバーを再起動したら直った（2026-10-03。どちらが効いたかは切り分けていない）。
// 重なる画面は一覧から開いたときだけ使うので、事前にページを作っておく必要もない

export default async function SceneModal({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const detail = getSceneDetail(slug);
  if (!detail) notFound();
  return (
    <Modal>
      <SceneDetail detail={detail} />
    </Modal>
  );
}
