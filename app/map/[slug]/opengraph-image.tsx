import { ImageResponse } from "next/og";
import { getSceneDetail, sceneIds } from "@/lib/map";
import {
  OG_COLORS as C,
  OG_SIZE,
  ogAerialTiles,
  ogFetchImage,
  ogFonts,
  ogMark,
} from "@/lib/og";
import { SITE_NAME } from "@/lib/site";

// 聖地のページ（/map/<id>）を SNS に貼ったときに出る画像。
// 左に現地の写真、右に場所の名前と曲名。「どこの、どの曲の聖地か」が画像だけで分かるようにする。
// MVの画面は使わない（公式映像の切り抜きになるため）。写真は Wikimedia Commons の自由ライセンスのもので、
// 撮影者名とライセンスを必ず画像の中に入れる。写真が無い場所は国土地理院の航空写真にする
export const alt = `ヨルシカの聖地（${SITE_NAME}）`;
export const size = OG_SIZE;
export const contentType = "image/png";

// ビルド時に全部の場所の画像を作っておく。書かないと SNS が読みに来るたびに作り直しになり、
// そのたびに写真とフォントを取りに行くので遅く、取得に失敗すると画像が出ない
export function generateStaticParams() {
  return sceneIds().map((slug) => ({ slug }));
}

const PHOTO_W = 660;
const LABEL = "ヨルシカの聖地";

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const d = getSceneDetail(slug);
  if (!d) throw new Error(`聖地が見つかりません: ${slug}`);

  const works = [...new Set(d.scenes.map((s) => `「${s.work}」`))].join("");
  // 「白浜海岸（伊豆下田）」がかっこの途中で折り返したので、かっこの部分は次の行に小さく出す
  const [mainName, subName] = d.name.split(/(?=（)/);
  // 場所の写真が無ければ、場面ごとの写真のうち最初のものを使う
  const photo = d.photo ?? d.scenes.find((s) => s.photo)?.photo;
  const credit = photo
    ? `写真：${photo.artist}（${photo.license}）・Wikimedia Commons`
    : "航空写真：国土地理院（シームレス空中写真）を加工";

  const [fonts, mark, photoSrc, tiles] = await Promise.all([
    ogFonts(
      LABEL + d.name + d.prefecture + works + SITE_NAME + credit + "MVの舞台",
    ),
    ogMark(),
    // 1280px の縮小画像。元の写真は数MBあることがあるので使わない
    photo ? ogFetchImage(photo.thumb.replace("/500px-", "/1280px-")) : null,
    photo ? null : ogAerialTiles(d.lat, d.lon, PHOTO_W, OG_SIZE.height),
  ]);

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        background: C.paper,
        color: C.ink,
      }}
    >
      <div
        style={{
          position: "relative",
          width: PHOTO_W,
          height: "100%",
          display: "flex",
          overflow: "hidden",
        }}
      >
        {photoSrc ? (
          <img
            src={photoSrc}
            width={PHOTO_W}
            height={OG_SIZE.height}
            style={{ objectFit: "cover" }}
          />
        ) : (
          tiles!.map((t) => (
            <img
              key={t.src}
              src={t.src}
              width={256}
              height={256}
              style={{ position: "absolute", left: t.left, top: t.top }}
            />
          ))
        )}
        {/* 航空写真だとどこが聖地か分からないので、真ん中に印を付ける */}
        {!photoSrc && (
          <div
            style={{
              position: "absolute",
              left: PHOTO_W / 2 - 22,
              top: OG_SIZE.height / 2 - 22,
              width: 44,
              height: 44,
              borderRadius: 22,
              border: "5px solid #fff",
              boxShadow: "0 0 0 2px rgba(0,0,0,.5)",
            }}
          />
        )}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            display: "flex",
            padding: "6px 14px",
            fontFamily: "sans",
            fontSize: 15,
            color: "#fff",
            background: "rgba(0,0,0,.45)",
          }}
        >
          {credit}
        </div>
      </div>

      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          padding: "64px 56px 48px",
        }}
      >
        <div style={{ fontFamily: "sans", fontSize: 26, color: C.accent }}>
          {LABEL}
        </div>
        <div
          style={{
            fontFamily: "serif",
            fontSize: mainName.length > 7 ? 52 : 64,
            marginTop: 14,
            lineHeight: 1.25,
          }}
        >
          {mainName}
        </div>
        {subName && (
          <div style={{ fontFamily: "serif", fontSize: 30, marginTop: 4 }}>
            {subName}
          </div>
        )}
        <div
          style={{
            fontFamily: "sans",
            fontSize: 26,
            marginTop: 14,
            color: C.muted,
          }}
        >
          {d.prefecture}
        </div>
        {/* 曲名が長いと「のMVの舞台」が途中で折り返すので、曲名と説明を別の行にする */}
        <div style={{ fontFamily: "sans", fontSize: 30, marginTop: 30 }}>
          {works}
        </div>
        <div
          style={{
            fontFamily: "sans",
            fontSize: 22,
            marginTop: 6,
            color: C.muted,
          }}
        >
          MVの舞台
        </div>
        <div style={{ flex: 1, display: "flex" }} />
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <img src={mark} width={56} height={56} style={{ borderRadius: 28 }} />
          <div style={{ fontFamily: "serif", fontSize: 26 }}>{SITE_NAME}</div>
        </div>
      </div>
    </div>,
    { ...size, fonts },
  );
}
