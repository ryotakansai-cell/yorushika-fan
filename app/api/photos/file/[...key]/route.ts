import { NextRequest } from "next/server";
import { getPhotoBucket } from "@/lib/photos";

// みんなの写真の画像そのものを R2 から返す。
// バケットを公開にせずサイトを通すのは、消した写真がその場で見えなくなるようにするため
export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ key: string[] }> },
) {
  const key = (await params).key.join("/");
  // 投稿の置き場所（spots/<聖地>/<ランダムな名前>.jpg）以外は返さない
  if (!/^spots\/[a-z0-9-]+\/[0-9a-f-]+\.jpg$/.test(key)) {
    return new Response("Not found", { status: 404 });
  }
  const obj = await getPhotoBucket().get(key);
  if (!obj) return new Response("Not found", { status: 404 });
  return new Response(obj.body, {
    headers: {
      "Content-Type": "image/jpeg",
      ETag: obj.httpEtag,
      // ブラウザに覚えておいてもらうのは1時間だけ（長くすると、消した写真が見た人の画面に残り続けるため）
      "Cache-Control": "public, max-age=3600",
    },
  });
}
