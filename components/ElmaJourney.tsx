"use client";

import "leaflet/dist/leaflet.css";
import type { Circle, CircleMarker, Map as LeafletMap } from "leaflet";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

// 「エルマの旅」の本体。左（スマホは上）に地図、右（スマホは下）に日記の日付順の年表。
// 年表をスクロールすると、画面のまん中に来た日の場所へ地図が動く。行を押しても動く。
// 「読み進めると旅が進む」体験にするため、ボタンではなくスクロールで地図を動かしている。
//
// 地図ライブラリ（Leaflet）はブラウザでしか動かないので、聖地巡礼マップと同じく useEffect の中で読み込む。
// このファイルから lib/songs.ts を読み込むと日記や曲の JSON がまるごとブラウザに送られるので、
// 必要なものだけをページ側で組み立てて props で受け取る。

export type JourneyEntry = {
  date: string;
  town: string;
  summary: string;
  /** その日に書かれた曲。曲ページがあれば href が付く（歌の無い曲には曲ページが無い） */
  songs: { title: string; href?: string }[];
  pt?: [number, number];
  precision?: "spot" | "town" | "area";
  /** 聖地巡礼マップの見比べ画面 */
  spotHref?: string;
  /** その場所の写真（Wikimedia Commons。撮影者名とライセンスを必ず表示する） */
  photo?: { thumb: string; page: string; license: string; artist: string };
};

// 色は globals.css と合わせている（Leaflet は CSS 変数を読めないので値で書く）
const ACCENT = "#3d6485";
const MUTED = "#a39d92";

/** 確かさごとの、飛んだときの拡大率。街のどこかなら街全体、場所が分かるなら建物が見えるくらい */
const ZOOM = { spot: 15, town: 12, area: 11 } as const;

/** 範囲（area）の円の半径（m）。ヴィスビーの北の海岸を覆うくらい */
const AREA_RADIUS = 5000;

const PRECISION_NOTE = {
  spot: "",
  town: "街のおおよその位置",
  area: "日記からは場所を特定できない（ヴィスビーの北の海岸のどこか）",
} as const;

export function ElmaJourney({ entries }: { entries: JourneyEntry[] }) {
  const mapBox = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  // 日ごとの印（同じ場所に何日分も重なるので、日ではなく場所ごとに1つ）
  const marksRef = useRef(new Map<string, CircleMarker | Circle>());
  /** 範囲（area）の印の key。点と範囲で、目立たせ方を変えるため */
  const areaKeys = useRef(new Set<string>());
  const rowRefs = useRef<(HTMLLIElement | null)[]>([]);
  // 今の日。-1 はまだ読み始めていない状態で、地図は旅の全体を見せる
  const [active, setActive] = useState(-1);
  // ページを開いた瞬間にも、画面のまん中にある行が「今の日」と判定されて地図が寄ってしまい、
  // 旅の全体が見えなかった。読み始める（スクロールする・行を押す）までは全体のままにする
  const startedRef = useRef(false);
  const [ready, setReady] = useState(false);

  // ① 地図を作り、旅の道のり（線）と場所の印を置く（最初の1回だけ）
  useEffect(() => {
    let cancelled = false;
    const marks = marksRef.current;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !mapBox.current) return;

      const map = L.map(mapBox.current, {
        scrollWheelZoom: false,
        zoomSnap: 0.5,
      });
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>',
        maxZoom: 19,
      }).addTo(map);

      const pts = entries.filter((e) => e.pt).map((e) => e.pt!);
      // 最初は旅の全体（ルンドからフォーレ島まで）が見えるようにする
      map.fitBounds(L.latLngBounds(pts), { padding: [30, 30] });

      // 日付順に結んだ線。範囲（area）の日は線をつながない（場所が分からないのに線を引くと、そこへ行ったように見える）
      L.polyline(
        entries.filter((e) => e.pt && e.precision !== "area").map((e) => e.pt!),
        { color: ACCENT, weight: 2, opacity: 0.5, dashArray: "4 6" },
      ).addTo(map);

      for (const e of entries) {
        if (!e.pt) continue;
        const key = e.pt.join(",");
        if (marks.has(key)) continue;
        const mark =
          e.precision === "area"
            ? L.circle(e.pt, {
                radius: AREA_RADIUS,
                color: MUTED,
                weight: 1,
                dashArray: "4 4",
                fillOpacity: 0.08,
              })
            : L.circleMarker(e.pt, {
                radius: e.precision === "town" ? 6 : 5,
                color: "#fff",
                weight: 2,
                fillColor: MUTED,
                fillOpacity: 1,
              });
        mark.addTo(map);
        marks.set(key, mark);
        if (e.precision === "area") areaKeys.current.add(key);
      }

      mapRef.current = map;
      setReady(true);
    })();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      marks.clear();
    };
  }, [entries]);

  // ② 画面のまん中を通った行を「今の日」にする。上下45%ずつを外した帯に入った行だけを見る
  useEffect(() => {
    let current = -1;
    const observer = new IntersectionObserver(
      (records) => {
        for (const r of records) {
          if (r.isIntersecting)
            current = Number((r.target as HTMLElement).dataset.index);
        }
        if (startedRef.current) setActive(current);
      },
      { rootMargin: "-45% 0px -50% 0px" },
    );
    for (const el of rowRefs.current) if (el) observer.observe(el);
    // 最初のスクロールで読み始めたことにし、その時点でまん中にある行へ地図を動かす
    const start = () => {
      startedRef.current = true;
      if (current >= 0) setActive(current);
    };
    window.addEventListener("scroll", start, { once: true, passive: true });
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", start);
    };
  }, [entries]);

  // ③ 今の日が変わったら、その場所へ地図を動かし、印を目立たせる。
  // 場所の無い日（フェリーの中など）は地図を動かさない
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const e = entries[active];
    const key = e?.pt?.join(",");
    for (const [k, mark] of marksRef.current) {
      const on = k === key;
      // 範囲の円は線の色、点は塗りの色を差し色にする
      if (areaKeys.current.has(k))
        mark.setStyle({ color: on ? ACCENT : MUTED });
      else mark.setStyle({ fillColor: on ? ACCENT : MUTED });
      if (on) mark.bringToFront();
    }
    if (e?.pt) map.flyTo(e.pt, ZOOM[e.precision ?? "town"], { duration: 0.8 });
  }, [active, ready, entries]);

  /** 行を押したとき: その行を画面のまん中まで動かす（動いた先で ② が働いて地図も動く） */
  function jump(i: number) {
    startedRef.current = true;
    rowRefs.current[i]?.scrollIntoView({ behavior: "smooth", block: "center" });
    setActive(i);
  }

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:gap-6">
      {/* 地図。スクロールしても見えるように固定する（スマホは上、PCは左） */}
      <div className="sticky top-0 z-10 -mx-5 bg-paper px-5 pb-2 pt-2 lg:top-4 lg:mx-0 lg:self-start lg:px-0 lg:pt-0">
        <div
          ref={mapBox}
          className="relative z-0 h-[38vh] w-full overflow-hidden rounded-lg border border-line bg-card lg:h-[calc(100vh-7rem)]"
          aria-label="エルマの旅の地図"
        />
        <p className="mt-1 text-xs text-muted">
          {active < 0
            ? `旅の全体（${entries[0]?.date}〜${entries.at(-1)?.date}）。下へ読み進めると、地図がその日の場所へ動きます`
            : `${entries[active].date}　${entries[active].town}`}
        </p>
      </div>

      {/* 日記の年表 */}
      <ol className="mt-4 lg:mt-0">
        {entries.map((e, i) => (
          <li
            key={`${e.date}-${i}`}
            ref={(el) => {
              rowRefs.current[i] = el;
            }}
            data-index={i}
            // スマホでは地図が上に固定されているので、行が地図の裏に隠れないよう止まる位置をずらす
            className="scroll-mt-[46vh] border-l-2 py-4 pl-4 transition-colors lg:scroll-mt-4"
            style={{ borderColor: i === active ? ACCENT : "transparent" }}
          >
            <button
              type="button"
              onClick={() => jump(i)}
              className="block w-full text-left"
            >
              <span className="flex flex-wrap items-baseline gap-x-3">
                <span className="font-serif text-lg tabular-nums text-ink">
                  {e.date}
                </span>
                <span className="text-sm text-muted">{e.town}</span>
              </span>
              <span className="mt-1 block text-sm leading-relaxed text-ink">
                {e.summary}
              </span>
              {e.precision && PRECISION_NOTE[e.precision] && (
                <span className="mt-1 block text-xs text-muted">
                  地図の位置：{PRECISION_NOTE[e.precision]}
                </span>
              )}
            </button>

            {/* その場所の写真。押すと Commons の元のページ（撮影者・ライセンスの詳細）へ */}
            {e.photo && (
              <figure className="mt-3">
                <a
                  href={e.photo.page}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <span className="relative block aspect-[3/2] w-full max-w-sm overflow-hidden rounded-md border border-line bg-line">
                    <Image
                      src={e.photo.thumb}
                      alt={`${e.town}の写真`}
                      fill
                      sizes="384px"
                      className="object-cover"
                    />
                  </span>
                </a>
                <figcaption className="mt-1 text-xs text-muted">
                  撮影：{e.photo.artist}（{e.photo.license}・Wikimedia Commons）
                </figcaption>
              </figure>
            )}

            {(e.songs.length > 0 || e.spotHref || e.pt) && (
              <div className="mt-2 flex flex-wrap gap-2 text-sm">
                {e.songs.map((s) =>
                  s.href ? (
                    <Link
                      key={s.title}
                      href={s.href}
                      className="rounded-full border border-accent px-3 py-0.5 text-accent transition hover:bg-accent hover:text-card"
                    >
                      ♪ {s.title}
                    </Link>
                  ) : (
                    // 歌の無い曲は公式の歌詞ページに載っていないので、曲ページが無い
                    <span
                      key={s.title}
                      className="rounded-full border border-line px-3 py-0.5 text-muted"
                    >
                      ♪ {s.title}（歌なし）
                    </span>
                  ),
                )}
                {e.spotHref && (
                  <Link
                    href={e.spotHref}
                    className="rounded-full border border-line px-3 py-0.5 text-ink transition hover:border-accent hover:text-accent"
                  >
                    聖地巡礼マップで見る
                  </Link>
                )}
                {/* 今の景色を自分で確かめられるように。場所が特定できる日はストリートビュー、街のどこかなら地図 */}
                {e.pt && e.precision === "spot" && (
                  <a
                    href={`https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${e.pt[0]},${e.pt[1]}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-full border border-line px-3 py-0.5 text-muted transition hover:border-accent hover:text-accent"
                  >
                    ストリートビュー
                  </a>
                )}
                {e.pt && e.precision !== "area" && (
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${e.pt[0]},${e.pt[1]}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-full border border-line px-3 py-0.5 text-muted transition hover:border-accent hover:text-accent"
                  >
                    Googleマップ
                  </a>
                )}
              </div>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
