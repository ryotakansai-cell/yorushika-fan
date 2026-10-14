// JPEG の付加情報（位置情報など）を取り除く処理。みんなの写真の投稿で使う。
// ほかの部品に頼らない作りにして、手元で実際の写真を使って試せるようにしている

/**
 * JPEG から、位置情報や撮影機器の情報が入る部分（APP1〜APP15 と COM）を取り除く。
 * ブラウザで描き直した時点で付加情報は消えているが、ブラウザを通さずに直接送ってくる場合に備えて、
 * サーバーでも必ず消す。画像の本体（SOS 以降）には手を付けないので、見た目は変わらない。
 * JPEG でなければ null を返す（受け付けない）
 */
export function stripJpegMetadata(src: Uint8Array) {
  if (src.length < 4 || src[0] !== 0xff || src[1] !== 0xd8) return null;
  const parts: Uint8Array[] = [src.subarray(0, 2)];
  let i = 2;
  let width = 0;
  let height = 0;
  while (i + 4 <= src.length) {
    if (src[i] !== 0xff) return null;
    const marker = src[i + 1];
    // SOS（ここから先は画像の本体）。残りをそのまま付けて終わり
    if (marker === 0xda) {
      parts.push(src.subarray(i));
      break;
    }
    const len = (src[i + 2] << 8) | src[i + 3];
    const end = i + 2 + len;
    if (end > src.length) return null;
    // 画像の大きさ（SOF0〜SOF3）
    if (marker >= 0xc0 && marker <= 0xc3) {
      height = (src[i + 5] << 8) | src[i + 6];
      width = (src[i + 7] << 8) | src[i + 8];
    }
    const isMeta = (marker >= 0xe1 && marker <= 0xef) || marker === 0xfe;
    if (!isMeta) parts.push(src.subarray(i, end));
    i = end;
  }
  if (!width || !height) return null;
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return { bytes: out, width, height };
}
