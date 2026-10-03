"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";

/**
 * その場所の航空写真の小さな地図。見比べ画面の右側で、写真も埋め込みも無い場所に出す最後の手段。
 * 国土地理院の航空写真は日本中どこでも、出典の表示だけで使えるので、
 * 「現地の写真はまだありません」で空になる場所を無くせる（2026-10-03 オーナーの指摘で追加）
 */
export function AerialMiniMap({
  lat,
  lon,
  title,
}: {
  lat: number;
  lon: number;
  title: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    let remove: (() => void) | undefined;

    // 地図ライブラリはブラウザでしか動かないので、画面に出た後に読み込む
    import("leaflet").then(({ default: L }) => {
      if (cancelled || !ref.current) return;
      const map = L.map(ref.current, {
        center: [lat, lon],
        zoom: 17,
        scrollWheelZoom: false,
      });
      L.tileLayer(
        "https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg",
        {
          attribution:
            '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noopener noreferrer">地理院タイル</a>',
          maxZoom: 18,
        },
      ).addTo(map);
      // 場所の印。画像を使わない円にする（Leaflet 既定の画像の印はバンドラーで壊れるため）
      L.circleMarker([lat, lon], {
        radius: 8,
        color: "#fffdf8",
        weight: 3,
        fillColor: "#3d6485",
        fillOpacity: 1,
      }).addTo(map);
      remove = () => map.remove();
    });

    return () => {
      cancelled = true;
      remove?.();
    };
  }, [lat, lon]);

  return (
    <div
      ref={ref}
      aria-label={title}
      className="relative z-0 aspect-video w-full overflow-hidden rounded-lg border border-line bg-line"
    />
  );
}
