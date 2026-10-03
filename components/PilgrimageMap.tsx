"use client";

import "leaflet/dist/leaflet.css";
import type { CircleMarker, Map as LeafletMap } from "leaflet";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Spot, SpotCategory } from "@/lib/map";

// 地図と一覧をひとつにしたコンポーネント。
// 一覧の「地図で見る」で地図を動かし、地図の印を押すと一覧の該当行を強調する、
// という行き来があるので、両方の状態をここで持つ。
//
// 地図ライブラリ（Leaflet）はブラウザの window を前提に作られていてサーバーでは動かない。
// そこで useEffect（画面に出た後にブラウザだけで動く）の中で import() して読み込む。
// 一覧は普通の React なのでサーバーで HTML になり、検索エンジンにも内容が渡る。

type Filter = "all" | SpotCategory;

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "すべて" },
  { value: "scene", label: "MVの舞台" },
  { value: "live", label: "ライブ会場" },
  { value: "event", label: "展示・コラボ" },
];

// 印の色。globals.css の色と合わせている（Leaflet は CSS 変数を読めないので値で書く）
const COLOR = {
  live: "#3d6485", // accent（落ち着いた青）
  event: "#a0663a", // 展示は区別がつくよう暖色
  scene: "#5d7d55", // MVの舞台。風景の場所なので落ち着いた緑
  inactive: "#a39d92", // 閉館・終了したもの
};

const STATUS_LABEL = {
  upcoming: "開催予定",
  ongoing: "開催中",
  ended: "終了",
} as const;

function markerColor(s: Spot) {
  if (s.closed || s.status === "ended") return COLOR.inactive;
  return COLOR[s.category];
}

export function PilgrimageMap({ spots }: { spots: Spot[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markersRef = useRef(new Map<string, CircleMarker>());
  const [ready, setReady] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState<string | null>(null);

  const visible = useMemo(
    () => spots.filter((s) => filter === "all" || s.category === filter),
    [spots, filter],
  );

  // ① 地図を作る（最初の1回だけ）
  useEffect(() => {
    // 開発時の React は effect を2回動かして後片付け漏れを探す。
    // 読み込み待ちの間に片付けが走ったら、地図を作らずに終わる
    let cancelled = false;
    // 後片付けの時点で ref の中身が差し替わっていても、この回で作った印を確実に消すため手元に取っておく
    const markers = markersRef.current;

    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !containerRef.current) return;

      const map = L.map(containerRef.current, {
        // 地図の上でスクロールしたときにページではなく地図が拡大されると、
        // スマホで下の一覧へ進めなくなるので、ホイール拡大は切っておく
        scrollWheelZoom: false,
        // 1段刻みだと全地点を収めたときに引きすぎるので、半段刻みにする
        zoomSnap: 0.5,
      });
      // 中心と倍率を決め打ちにすると札幌や沖縄が画面の外に出たので、
      // 全地点が収まる範囲を地点から計算して表示する
      map.fitBounds(L.latLngBounds(spots.map((s) => [s.lat, s.lon])), {
        padding: [24, 24],
      });

      // 国土地理院の「淡色地図」。日本語の地名が出て、サイトの落ち着いた配色に合う。
      // 利用条件は出典の明記のみ
      L.tileLayer("https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png", {
        attribution:
          '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noopener noreferrer">地理院タイル</a>',
        maxZoom: 18,
      }).addTo(map);

      for (const s of spots) {
        // 画像の印はバンドラーと相性が悪い（既定の画像パスが壊れる）ので、
        // 画像を使わない円の印にしている
        const marker = L.circleMarker([s.lat, s.lon], {
          radius: 7,
          color: "#fffdf8",
          weight: 2,
          fillColor: markerColor(s),
          fillOpacity: 0.9,
        });

        // 吹き出しの中身は文字列の HTML ではなく DOM で組む（名前に記号が入っても崩れない）
        const box = document.createElement("div");
        const title = document.createElement("strong");
        title.textContent = s.name;
        const sub = document.createElement("div");
        sub.textContent = [
          s.kindLabel,
          s.closed ? "閉館" : s.status ? STATUS_LABEL[s.status] : null,
          s.evidenceLabel,
          s.entries[0]?.title,
        ]
          .filter(Boolean)
          .join(" / ");
        sub.style.marginTop = "2px";
        box.append(title, sub);
        marker.bindPopup(box);

        marker.on("click", () => setSelected(s.id));
        markers.set(s.id, marker);
      }

      mapRef.current = map;
      setReady(true);
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markers.clear();
    };
  }, [spots]);

  // ② 絞り込みが変わったら、地図に出す印を入れ替える
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const ids = new Set(visible.map((s) => s.id));
    for (const [id, marker] of markersRef.current) {
      if (ids.has(id)) marker.addTo(map);
      else marker.remove();
    }
  }, [ready, visible]);

  // ③ URL の # で場所が指定されていたら（MVページの「この曲の舞台」から来たとき）その場所を開く。
  // ② より後に書いているのは、effect は書いた順に動くため。印が地図に置かれる前に
  // 吹き出しを開こうとしても何も起きない（最初はこの順番を逆に書いていて開かなかった）。
  // ページを開いた直後なので、移動のアニメーションはせずにいきなりその場所を出す。
  // ?spot= ではなく # にしているのは、このページを「1日1回作るだけ」の静的なページのままにするため
  // （? の値を読むと、アクセスのたびにサーバーでページを作る必要が出る）
  useEffect(() => {
    if (!ready) return;
    const id = decodeURIComponent(window.location.hash.slice(1));
    const target = spots.find((s) => s.id === id);
    if (target) showOnMap(target, false);
  }, [ready, spots]);

  function showOnMap(s: Spot, animate = true) {
    const map = mapRef.current;
    if (!map) return;
    setSelected(s.id);
    if (animate) map.flyTo([s.lat, s.lon], 15, { duration: 0.8 });
    else map.setView([s.lat, s.lon], 15);
    markersRef.current.get(s.id)?.openPopup();
    // 一覧は地図の下にあるので、押したら地図が見える位置まで戻す
    containerRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }

  return (
    <div>
      {/* 種別の絞り込み */}
      <div className="flex gap-2" role="tablist" aria-label="種別で絞り込む">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            role="tab"
            aria-selected={filter === f.value}
            onClick={() => setFilter(f.value)}
            className={`rounded-full border px-3 py-1 text-sm transition ${
              filter === f.value
                ? "border-accent bg-accent text-card"
                : "border-line bg-card text-muted hover:text-accent"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* 地図。z-0 にしないと Leaflet の部品がヘッダーより手前に出る */}
      <div
        ref={containerRef}
        className="relative z-0 mt-4 h-[55vh] min-h-80 w-full overflow-hidden rounded-lg border border-line bg-card"
        aria-label="聖地巡礼マップ"
      />

      {/* 凡例 */}
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        <Legend color={COLOR.scene} label="MVの舞台" />
        <Legend color={COLOR.live} label="ライブ会場" />
        <Legend color={COLOR.event} label="展示・コラボ（開催中・予定）" />
        <Legend color={COLOR.inactive} label="終了した展示・閉館した会場" />
      </ul>

      {/* 一覧（都道府県ごと） */}
      <div className="mt-10">
        {groupByPrefecture(visible).map(([pref, list]) => (
          <section key={pref} className="mt-8 first:mt-0">
            <h2 className="font-serif text-lg text-ink">{pref}</h2>
            <ul className="mt-3 divide-y divide-line border-y border-line">
              {list.map((s) => (
                <SpotRow
                  key={s.id}
                  spot={s}
                  selected={selected === s.id}
                  onShow={() => showOnMap(s)}
                />
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <li className="flex items-center gap-1.5">
      <span
        className="inline-block size-2.5 rounded-full"
        style={{ backgroundColor: color }}
      />
      {label}
    </li>
  );
}

function groupByPrefecture(spots: Spot[]) {
  const groups = new Map<string, Spot[]>();
  for (const s of spots) {
    groups.set(s.prefecture, [...(groups.get(s.prefecture) ?? []), s]);
  }
  return [...groups.entries()];
}

function SpotRow({
  spot: s,
  selected,
  onShow,
}: {
  spot: Spot;
  selected: boolean;
  onShow: () => void;
}) {
  const badge = s.closed ? "閉館" : s.status ? STATUS_LABEL[s.status] : null;
  const active = !s.closed && s.status !== "ended";

  return (
    <li className={`py-4 transition-colors ${selected ? "bg-accent/5" : ""}`}>
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="font-serif text-ink">{s.name}</span>
        <span className="text-xs text-muted">{s.kindLabel}</span>
        {/* MVの舞台の根拠。「推定」は確かさが低いので控えめな見た目にする */}
        {s.evidenceLabel && (
          <span
            className={`rounded border px-1.5 py-px text-xs ${
              s.evidence === "estimate"
                ? "border-line text-muted"
                : "border-accent text-accent"
            }`}
          >
            {s.evidenceLabel}
          </span>
        )}
        {badge && (
          <span
            className={`rounded px-1.5 py-0.5 text-xs ${
              active ? "bg-accent text-card" : "bg-line text-muted"
            }`}
          >
            {badge}
          </span>
        )}
      </div>

      {s.address && <p className="mt-1 text-xs text-muted">{s.address}</p>}

      <ul className="mt-2 space-y-1 text-sm">
        {s.entries.map((e, i) => (
          // 同じ曲の場面が1か所に2つある（雨晴駅の 0:37 と 0:48）ので、題名だけでは key が重なる
          <li key={`${e.title}-${i}`} className="flex flex-wrap gap-x-3">
            <span className="tabular-nums text-muted">{e.dateLabel}</span>
            <a
              href={e.source}
              target="_blank"
              rel="noopener noreferrer"
              className="text-ink transition hover:text-accent"
            >
              {e.title}
            </a>
            {/* 人が場面と現地を見比べて一致を確かめた場面。何を見たかはマウスを乗せると出る */}
            {e.verifiedHow && (
              <span className="text-xs text-accent" title={e.verifiedHow}>
                照合済み
              </span>
            )}
          </li>
        ))}
      </ul>

      {/* 出典。MVの舞台は公式が場所を明言していないので、誰が言っているかを必ず見せる */}
      {s.sources && s.sources.length > 0 && (
        <p className="mt-2 text-xs text-muted">
          出典：
          {s.sources.map((src, i) => (
            <span key={src.url}>
              {i > 0 && "、"}
              <a
                href={src.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-ink transition hover:text-accent"
              >
                {src.label}
              </a>
            </span>
          ))}
        </p>
      )}

      {(s.note || s.approximate) && (
        <p className="mt-2 text-xs text-muted">
          {s.note}
          {s.approximate && !s.note?.includes("おおよそ")
            ? "（地図上の位置はおおよそ）"
            : ""}
        </p>
      )}

      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
        <button
          type="button"
          onClick={onShow}
          className="text-muted transition hover:text-accent"
        >
          地図で見る
        </button>
        <a
          href={s.googleMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted transition hover:text-accent"
        >
          Google マップで開く
        </a>
        {/* MVの場面と現地の風景を見比べられるように */}
        {s.streetViewUrl && (
          <a
            href={s.streetViewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted transition hover:text-accent"
          >
            ストリートビューで見る
          </a>
        )}
      </div>
    </li>
  );
}
