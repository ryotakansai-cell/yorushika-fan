import { ImageResponse } from "next/og";
import { OG_COLORS as C, OG_SIZE, ogFonts, ogMark } from "@/lib/og";
import { SITE_NAME } from "@/lib/site";

// SNS にサイトのURLを貼ったときに出る画像（サイト共通）。
// 自分の画像を持たないページ（トップ・ニュース・作品一覧など）は全部これになる
export const alt = `${SITE_NAME}（ニュース・MV・聖地巡礼マップ）`;
export const size = OG_SIZE;
export const contentType = "image/png";

const SUB = "ニュース・MV・聖地巡礼マップ";
const NOTE = "ヨルシカの非公式ファンサイト";
const URL_TEXT = "yorushika.sukinote.com";

export default async function Image() {
  const [fonts, mark] = await Promise.all([
    ogFonts(SITE_NAME + SUB + NOTE + URL_TEXT),
    ogMark(),
  ]);
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        background: C.paper,
        color: C.ink,
        padding: "0 80px",
        gap: 56,
      }}
    >
      {/* アイコンは丸く切り抜いて、Bluesky のアイコンと同じ見え方にする */}
      <img
        src={mark}
        width={260}
        height={260}
        style={{ borderRadius: 130, border: `2px solid ${C.ink}1a` }}
      />
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ fontFamily: "sans", fontSize: 26, color: C.accent }}>
          {NOTE}
        </div>
        <div style={{ fontFamily: "serif", fontSize: 72, marginTop: 8 }}>
          {SITE_NAME}
        </div>
        <div style={{ fontFamily: "sans", fontSize: 34, marginTop: 18 }}>
          {SUB}
        </div>
        <div
          style={{
            fontFamily: "sans",
            fontSize: 24,
            marginTop: 44,
            color: C.muted,
          }}
        >
          {URL_TEXT}
        </div>
      </div>
    </div>,
    { ...size, fonts },
  );
}
