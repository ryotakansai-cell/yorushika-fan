import { notFound } from "next/navigation";
import { Modal } from "@/components/Modal";
import { SceneDetail } from "@/components/SceneDetail";
import { getSceneDetail } from "@/lib/map";

// 一覧から「MVの場面を見る」を押したときに、地図の上に重ねて出す見比べ画面。
// (.) は「同じ階層の [slug] へのページ移動を横取りする」という Next.js の決まり。
// ここには generateStaticParams を書かない（ドキュメントのモーダルの例にも無く、一覧から開いたときだけ使うため）。
//
// 開発サーバーの注意（2026-10-03 に2回起きた）: ファイルを編集して自動で再コンパイルされた直後に、
// 「/map/(.)(.)<id> は不正なインターセプトルート」というエラーになり、重なる画面ではなく単独ページで開くことがある。
// 開発サーバーを再起動すると直る。本番では起きない（本番で重なる画面が開くことをオーナーの画面で確認済み）。
// 最初は generateStaticParams が原因だと思って外したが、外した後にも起きたので関係なかった

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
