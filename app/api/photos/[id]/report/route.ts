import { NextRequest, NextResponse } from "next/server";
import { clientIp, hash, reportPhoto } from "@/lib/photos";

// 通報。別々の人からの通報が一定数たまると自動で非表示になる（lib/photos.ts の REPORTS_TO_HIDE）
export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) {
    return NextResponse.json(
      { error: "写真が見つかりません" },
      { status: 400 },
    );
  }
  await reportPhoto(id, await hash(`ip:${clientIp(request.headers)}`));
  return NextResponse.json({ reported: true });
}
