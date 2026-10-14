import { NextRequest, NextResponse } from "next/server";
import { deletePhotoByOwner } from "@/lib/photos";

// 投稿した人が自分の写真を消す。投稿したときに渡した削除の合言葉が合えば、R2 の写真ごと消す
export const dynamic = "force-dynamic";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const id = Number((await params).id);
  const body = (await request.json().catch(() => null)) as {
    token?: string;
  } | null;
  if (!Number.isInteger(id) || !body?.token) {
    return NextResponse.json({ error: "消せませんでした" }, { status: 400 });
  }
  const ok = await deletePhotoByOwner(id, body.token);
  return ok
    ? NextResponse.json({ deleted: true })
    : NextResponse.json({ error: "消せませんでした" }, { status: 403 });
}
