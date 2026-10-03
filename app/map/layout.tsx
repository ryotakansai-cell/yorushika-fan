// 地図のページと、その上に重ねて出す見比べ画面（@modal）を並べる。
// 一覧から「見比べる」を押すと、URL は /map/<id> に変わるが、地図（children）はそのまま残り、
// @modal に見比べ画面が出る。URL を直接開いたときは /map/[slug] の単独ページになる
export default function MapLayout({
  children,
  modal,
}: {
  children: React.ReactNode;
  modal: React.ReactNode;
}) {
  return (
    <>
      {children}
      {modal}
    </>
  );
}
