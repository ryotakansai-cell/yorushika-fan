// 地図の計算。聖地巡礼マップ（サーバー側）と聖地クイズ（ブラウザ側）の両方で使う。
// lib/map.ts に置くと、ブラウザ側で読み込んだときに地図データの JSON までまるごと送られるので、分けている。

/**
 * 2地点の直線距離（km）。地球を球とみなして緯度・経度から求める一般的な式（ハバーサイン公式）。
 * 数km の範囲なら、実際の距離とのずれは無視できる
 */
export function distanceKm(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number },
) {
  const R = 6371; // 地球の半径（km）
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** 「約350m」「約1.2km」「約230km」。直線距離なので「約」を付ける */
export function formatDistance(km: number) {
  if (km < 1) return `約${Math.max(50, Math.round((km * 1000) / 50) * 50)}m`;
  if (km < 10) return `約${km.toFixed(1)}km`;
  return `約${Math.round(km)}km`;
}
