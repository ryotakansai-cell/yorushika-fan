import { NextRequest, NextResponse } from "next/server";
import { sceneIds } from "@/lib/map";
import {
  MAX_BYTES,
  MAX_COMMENT,
  MAX_NAME,
  MAX_SIDE,
  canPostToday,
  clientIp,
  getPhotoBucket,
  hash,
  insertPhoto,
  listPhotos,
  newDeleteToken,
  stripJpegMetadata,
  verifyTurnstile,
} from "@/lib/photos";

// みんなの写真の一覧（GET）と投稿（POST）。
// 聖地のページは静的なまま、この欄だけブラウザから取りに来る（ページを速いままにするため）
export const dynamic = "force-dynamic";

const fail = (message: string, status = 400) =>
  NextResponse.json({ error: message }, { status });

export async function GET(request: NextRequest) {
  const spot = request.nextUrl.searchParams.get("spot") ?? "";
  if (!sceneIds().includes(spot)) return fail("聖地が見つかりません", 404);
  try {
    return NextResponse.json(
      { photos: await listPhotos(spot) },
      // 1分だけ使い回す（同じ時間に何人も開いても DB を何度も読まないように）
      { headers: { "Cache-Control": "public, max-age=60" } },
    );
  } catch (e) {
    console.error("みんなの写真の一覧を読めなかった", e);
    return fail("写真を読み込めませんでした", 500);
  }
}

export async function POST(request: NextRequest) {
  const form = await request.formData().catch(() => null);
  if (!form) return fail("送られてきた内容を読めませんでした");

  const spotId = String(form.get("spotId") ?? "");
  if (!sceneIds().includes(spotId)) return fail("聖地が見つかりません", 404);

  // 投稿画面の2つの確認（自分で撮った写真か・知らない人の顔が大きく写っていないか）
  if (form.get("ownPhoto") !== "1" || form.get("noFaces") !== "1") {
    return fail("投稿前の確認にチェックを入れてください");
  }

  const ip = clientIp(request.headers);
  if (!(await verifyTurnstile(String(form.get("turnstile") ?? ""), ip))) {
    return fail(
      "ロボットでないことの確認に失敗しました。もう一度お試しください",
      403,
    );
  }

  const ipHash = await hash(`ip:${ip}`);
  if (!(await canPostToday(ipHash))) {
    return fail("今日はこれ以上投稿できません。また明日お願いします", 429);
  }

  const file = form.get("photo");
  if (!(file instanceof File)) return fail("写真が選ばれていません");
  if (file.size > MAX_BYTES) return fail("写真が大きすぎます（3MBまで）");

  // 位置情報などの付加情報を取り除く。ブラウザでも消しているが、ここでも必ず消す
  const stripped = stripJpegMetadata(new Uint8Array(await file.arrayBuffer()));
  if (!stripped) return fail("JPEG の写真だけ投稿できます");
  if (stripped.width > MAX_SIDE * 2 || stripped.height > MAX_SIDE * 2) {
    return fail("写真が大きすぎます");
  }

  const comment =
    String(form.get("comment") ?? "")
      .trim()
      .slice(0, MAX_COMMENT) || null;
  const name =
    String(form.get("name") ?? "")
      .trim()
      .slice(0, MAX_NAME) || null;
  const month = String(form.get("takenMonth") ?? "");
  const takenMonth = /^\d{4}-(0[1-9]|1[0-2])$/.test(month) ? month : null;

  // 置き場所の名前は推測できないものにする（一覧に出ない写真を、名前を当てて見られないように）
  const key = `spots/${spotId}/${crypto.randomUUID()}.jpg`;
  const token = newDeleteToken();
  try {
    await getPhotoBucket().put(key, stripped.bytes, {
      httpMetadata: { contentType: "image/jpeg" },
    });
    const id = await insertPhoto({
      spotId,
      key,
      width: stripped.width,
      height: stripped.height,
      comment,
      name,
      takenMonth,
      deleteHash: await hash(token),
      ipHash,
    });
    // 削除の合言葉は、この返事でだけ渡す（投稿した人のブラウザに保存してもらう）
    return NextResponse.json({ id, deleteToken: token });
  } catch (e) {
    console.error("みんなの写真を保存できなかった", e);
    return fail("保存に失敗しました。時間をおいてもう一度お試しください", 500);
  }
}
