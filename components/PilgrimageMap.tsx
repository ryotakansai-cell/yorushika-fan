"use client";

import "leaflet/dist/leaflet.css";
import type { Map as LeafletMap, Marker, TileLayer } from "leaflet";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Spot, SpotCategory } from "@/lib/map";

// 聖地巡礼マップの本体。地図と写真カードの一覧を並べる。
//
// 動きは「選ぶ → 見比べる」の2段階（2026-10-03 オーナーと決めた）:
//   1. カードを押す → 地図がその場所へ飛び、吹き出しが開く。カードは「選択中」になる
//   2. 選択中のカード（または吹き出し）の「見比べる」→ 見比べ画面（/map/<id>）が地図の上に重なって開く
// 押すたびに見比べ画面が開くと、地図を眺めながら次々に場所を見て回る楽しさが無くなるため。
//
// 配置: PCは左に地図（スクロールしても固定）・右にカード。スマホは上に地図（固定）・下にカード。
// どちらも「カードを押すと、見えている地図が動く」ようにしている。
//
// 地図ライブラリ（Leaflet）はブラウザの window を前提に作られていてサーバーでは動かない。
// そこで useEffect（画面に出た後にブラウザだけで動く）の中で import() して読み込む。
// カードの一覧は普通の React なのでサーバーで HTML になり、検索エンジンにも内容が渡る。

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

const CATEGORY_ORDER: Record<SpotCategory, number> = {
  scene: 0,
  live: 1,
  event: 2,
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

/**
 * 地図の背景。2026-10-03 オーナーと比べて決めた（design/map-styles.png）:
 * - 国土地理院の淡色地図は、拡大すると等高線だらけの地形図になって映えなかった
 * - OpenStreetMap はGoogleマップに近いカラフルな地図で、引いた日本全体もきれい。世界中を描けるので
 *   将来ジャケットの舞台（スウェーデン）も載せられる。利用条件は出典の表示と、まとめて取得しないこと
 * - 国土地理院の航空写真は、拡大するとリアルで「この景色だ」と確かめやすいが、引くと雲や欠けが目立つ。
 *   なので普段は OpenStreetMap、切り替えで航空写真にする
 * - CARTO は登録（APIキー）が必要になっていたので使わない
 */
type Base = "map" | "photo";
const BASES: { value: Base; label: string }[] = [
  { value: "map", label: "地図" },
  { value: "photo", label: "航空写真" },
];

/**
 * ピンの見た目。写真（またはMVのサムネイル）を丸く切り抜いた印にする。
 * 文字列の HTML ではなく DOM で組む（URL や名前に記号が入っても崩れない）
 */
function pinElement(s: Spot) {
  const el = document.createElement("div");
  el.className = "photo-pin";
  if (s.image) {
    const img = document.createElement("img");
    // 地図の印は小さいので、YouTube のサムネイルは軽い中サイズ（320px）にする
    img.src = s.image.src.replace("/hqdefault.jpg", "/mqdefault.jpg");
    img.alt = "";
    el.append(img);
  } else {
    el.style.backgroundColor = markerColor(s);
  }
  return el;
}

export function PilgrimageMap({ spots }: { spots: Spot[] }) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markersRef = useRef(new Map<string, Marker>());
  const layersRef = useRef<Record<Base, TileLayer> | null>(null);
  const cardRefs = useRef(new Map<string, HTMLLIElement>());
  const [ready, setReady] = useState(false);
  const [base, setBase] = useState<Base>("map");
  const [filter, setFilter] = useState<Filter>("all");
  // 実際に載っている種別（絞り込みと凡例は、これが2つ以上のときだけ出す）
  const categories = useMemo(
    () => [...new Set(spots.map((s) => s.category))],
    [spots],
  );
  const [selected, setSelected] = useState<string | null>(null);

  // 「すべて」では、写真のある主役の「MVの舞台」を先頭にする。
  // 北から順のままだと、先頭が北海道のライブ会場になって MVの舞台が一覧の奥に埋もれていた。
  // MVの舞台の中は scenes.json に書いた順（rank）。ライブ会場と展示は受け取った順（北→南）のまま
  // （rank が無いものは同じ値になり、sort は同じ値どうしの順番を保つ）
  const visible = useMemo(
    () =>
      spots
        .filter((s) => filter === "all" || s.category === filter)
        .sort(
          (a, b) =>
            CATEGORY_ORDER[a.category] - CATEGORY_ORDER[b.category] ||
            (a.rank ?? 0) - (b.rank ?? 0),
        ),
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

      // 背景は2種類作っておき、切り替えのときに入れ替える（BASES の説明を参照）。
      // どちらも出典の表示が利用の条件
      const layers: Record<Base, TileLayer> = {
        map: L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>',
          maxZoom: 19,
        }),
        photo: L.tileLayer(
          "https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg",
          {
            attribution:
              '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noopener noreferrer">地理院タイル</a>（航空写真）',
            maxZoom: 18,
          },
        ),
      };
      layers.map.addTo(map);
      layersRef.current = layers;

      for (const s of spots) {
        // 印は丸い写真。Leaflet 既定の画像の印は、まとめて配信する仕組み（バンドラー）と相性が悪く
        // 画像のパスが壊れるので、自分で作った要素（divIcon）を印にしている
        const marker = L.marker([s.lat, s.lon], {
          icon: L.divIcon({
            html: pinElement(s),
            className: "", // Leaflet 既定の白い四角の枠を付けない
            iconSize: [44, 44],
            iconAnchor: [22, 22],
            popupAnchor: [0, -22],
          }),
          title: s.name,
        });
        marker.bindPopup(popupContent(s, (href) => router.push(href)));
        // ピンを押したら、そのカードを選択中にして一覧をそこまで動かす
        marker.on("click", () => {
          setSelected(s.id);
          scrollToCard(s.id);
        });
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
    // router は画面の間ずっと同じものなので、地図を作り直す理由にはしない
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // ③ 選択中のピンを少し大きくし、枠を差し色にする（どれを選んでいるか地図でも分かるように）。
  // 大きさは CSS（globals.css の .photo-pin.is-selected）で変え、重なったときに手前へ出す
  useEffect(() => {
    if (!ready) return;
    for (const [id, marker] of markersRef.current) {
      const on = id === selected;
      marker
        .getElement()
        ?.querySelector(".photo-pin")
        ?.classList.toggle("is-selected", on);
      marker.setZIndexOffset(on ? 1000 : 0);
    }
  }, [ready, selected]);

  // ⑤ 背景の切り替え（地図 ⇔ 航空写真）
  useEffect(() => {
    const map = mapRef.current;
    const layers = layersRef.current;
    if (!ready || !map || !layers) return;
    for (const [key, layer] of Object.entries(layers) as [Base, TileLayer][]) {
      if (key === base) layer.addTo(map);
      else layer.remove();
    }
  }, [ready, base]);

  // ④ URL の # で場所が指定されていたら（MVページなどから来たとき）その場所を開く。
  // ② より後に書いているのは、effect は書いた順に動くため。印が地図に置かれる前に
  // 吹き出しを開こうとしても何も起きない（最初はこの順番を逆に書いていて開かなかった）。
  // ページを開いた直後なので、移動のアニメーションはせずにいきなりその場所を出す。
  // ?spot= ではなく # にしているのは、このページを「1日1回作るだけ」の静的なページのままにするため
  // （? の値を読むと、アクセスのたびにサーバーでページを作る必要が出る）
  useEffect(() => {
    if (!ready) return;
    const id = decodeURIComponent(window.location.hash.slice(1));
    const target = spots.find((s) => s.id === id);
    if (target) {
      select(target, false);
      scrollToCard(target.id);
    }
  }, [ready, spots]);

  /** カードを押したとき: 地図をその場所へ動かし、吹き出しを開いて選択中にする */
  function select(s: Spot, animate = true) {
    const map = mapRef.current;
    setSelected(s.id);
    if (!map) return;
    if (animate) map.flyTo([s.lat, s.lon], 15, { duration: 0.8 });
    else map.setView([s.lat, s.lon], 15);
    markersRef.current.get(s.id)?.openPopup();
  }

  function scrollToCard(id: string) {
    // スマホでは地図が上に固定されているので、カードが地図の裏に隠れないよう
    // カード側の scroll-margin-top（地図の高さぶん）で止まる位置をずらしている
    cardRefs.current
      .get(id)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div>
      {/* 種別の絞り込み。種別が2つ以上あるときだけ出す（今はMVの舞台だけなので出ない。
          ジャケットの舞台などを足したら、自動でまた出てくる） */}
      {categories.length > 1 && (
        <div
          className="mb-4 flex flex-wrap gap-2"
          role="tablist"
          aria-label="種別で絞り込む"
        >
          {FILTERS.filter(
            (f) => f.value === "all" || categories.includes(f.value),
          ).map((f) => (
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
      )}

      <div className="lg:grid lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:gap-6">
        {/* 地図。スクロールしても見えるように固定する（スマホは上、PCは左） */}
        <div className="sticky top-0 z-10 -mx-5 bg-paper px-5 pb-2 pt-2 lg:top-4 lg:mx-0 lg:self-start lg:px-0 lg:pt-0">
          <div className="relative">
            {/* z-0 にしないと Leaflet の部品がヘッダーより手前に出る */}
            <div
              ref={containerRef}
              className="relative z-0 h-[38vh] w-full overflow-hidden rounded-lg border border-line bg-card lg:h-[calc(100vh-7rem)]"
              aria-label="聖地巡礼マップ"
            />
            {/* 背景の切り替え。Leaflet 付属の切り替えはサイトの見た目と合わず、画像のパスも
                バンドラーと相性が悪いので、自分で作っている。地図の右上に重ねる */}
            <div
              className="absolute right-2 top-2 z-[1] flex overflow-hidden rounded-full border border-line bg-card/95 text-xs shadow-sm"
              role="radiogroup"
              aria-label="地図の表示"
            >
              {BASES.map((b) => (
                <button
                  key={b.value}
                  type="button"
                  role="radio"
                  aria-checked={base === b.value}
                  onClick={() => setBase(b.value)}
                  className={`px-3 py-1.5 transition ${
                    base === b.value
                      ? "bg-accent text-card"
                      : "text-muted hover:text-accent"
                  }`}
                >
                  {b.label}
                </button>
              ))}
            </div>
          </div>
          {/* 凡例も、種別が2つ以上あるときだけ（1種類なら色の説明は要らない） */}
          {categories.length > 1 && (
            <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
              {FILTERS.filter(
                (f): f is { value: SpotCategory; label: string } =>
                  f.value !== "all" && categories.includes(f.value),
              ).map((f) => (
                <Legend key={f.value} color={COLOR[f.value]} label={f.label} />
              ))}
              {spots.some((s) => s.closed || s.status === "ended") && (
                <Legend color={COLOR.inactive} label="終了・閉館" />
              )}
            </ul>
          )}
        </div>

        {/* カードの一覧 */}
        <ul className="mt-4 space-y-3 lg:mt-0">
          {visible.map((s) => (
            <li
              key={s.id}
              ref={(el) => {
                if (el) cardRefs.current.set(s.id, el);
                else cardRefs.current.delete(s.id);
              }}
              className="scroll-mt-[46vh] lg:scroll-mt-4"
            >
              <SpotCard
                spot={s}
                selected={selected === s.id}
                onSelect={() => select(s)}
              />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/**
 * 吹き出しの中身。文字列の HTML ではなく DOM で組む（名前に記号が入っても崩れない）。
 * 「見比べる」は普通のリンクだとページ全体の読み込みになり、地図の上に重なる画面にならない。
 * そこで押されたら Next.js の画面切り替え（router.push）で開く
 */
function popupContent(s: Spot, navigate: (href: string) => void) {
  const box = document.createElement("div");
  const title = document.createElement("strong");
  title.textContent = s.name;
  const sub = document.createElement("div");
  sub.textContent = [
    s.kindLabel,
    s.closed ? "閉館" : s.status ? STATUS_LABEL[s.status] : null,
    s.evidenceLabel,
  ]
    .filter(Boolean)
    .join(" / ");
  sub.style.margin = "2px 0 6px";
  box.append(title, sub);

  if (s.detailHref) {
    const a = document.createElement("a");
    a.href = s.detailHref;
    a.textContent = "見比べる";
    a.addEventListener("click", (e) => {
      e.preventDefault();
      navigate(s.detailHref!);
    });
    box.append(a);
  } else if (s.entries[0]) {
    const a = document.createElement("a");
    a.href = s.entries[0].source;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.textContent = "公式の告知を見る";
    box.append(a);
  }
  return box;
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

/** カード1枚の短い説明（曲名と場面、ライブ名と日付、展示名と期間） */
function summary(s: Spot) {
  if (s.category === "scene") {
    return s.entries
      .map(
        (e) =>
          `${e.title.replace("（MV）", "")} ${e.dateLabel.replace(" の場面", "")}`,
      )
      .join("・");
  }
  const [first, ...rest] = s.entries;
  if (!first) return "";
  return `${first.title}（${first.dateLabel}）${rest.length > 0 ? ` ほか${rest.length}件` : ""}`;
}

function SpotCard({
  spot: s,
  selected,
  onSelect,
}: {
  spot: Spot;
  selected: boolean;
  onSelect: () => void;
}) {
  const badge = s.closed ? "閉館" : s.status ? STATUS_LABEL[s.status] : null;
  const inactive = s.closed || s.status === "ended";

  return (
    <div
      className={`overflow-hidden rounded-lg border bg-card transition ${
        selected
          ? "border-accent shadow-sm"
          : "border-line hover:border-accent/50"
      }`}
    >
      {/* カードの本体はボタン。リンク（見比べる など）はボタンの中に入れられない決まりなので、下の段に分けている */}
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        className="flex w-full gap-3 p-3 text-left"
      >
        <Thumb spot={s} inactive={inactive} />
        <span className="min-w-0 flex-1">
          <span className="block font-serif text-ink">{s.name}</span>
          <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
            <span>{s.kindLabel}</span>
            <span>{s.prefecture}</span>
            {s.evidenceLabel && (
              <span
                className={`rounded border px-1.5 py-px ${
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
                className={`rounded px-1.5 py-px ${
                  inactive ? "bg-line text-muted" : "bg-accent text-card"
                }`}
              >
                {badge}
              </span>
            )}
          </span>
          <span className="mt-1 line-clamp-2 block text-sm text-muted">
            {summary(s)}
          </span>
        </span>
      </button>

      {/* 選択中だけ出す段。ボタンだらけにならないよう、選んだカードにだけ出す */}
      {selected && (
        <div className="border-t border-line px-3 pb-3 pt-2">
          {/* ライブ会場は公演の一覧、展示は期間を出す（MVの舞台は見比べ画面で詳しく見る） */}
          {s.category !== "scene" && s.entries.length > 1 && (
            <ul className="mb-2 space-y-0.5 text-xs">
              {s.entries.map((e, i) => (
                <li key={`${e.title}-${i}`} className="flex flex-wrap gap-x-2">
                  <span className="tabular-nums text-muted">{e.dateLabel}</span>
                  <a
                    href={e.source}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-ink transition hover:text-accent"
                  >
                    {e.title}
                  </a>
                </li>
              ))}
            </ul>
          )}
          {(s.note || s.approximate) && (
            <p className="mb-2 text-xs text-muted">
              {s.note}
              {s.approximate && !s.note?.includes("おおよそ")
                ? "（地図上の位置はおおよそ）"
                : ""}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            {s.detailHref ? (
              // scroll={false}: 重なる画面を開くときに、裏の地図ページを一番上まで戻さない
              <Link
                href={s.detailHref}
                scroll={false}
                className="rounded-full bg-accent px-4 py-1.5 text-card transition hover:opacity-90"
              >
                見比べる
              </Link>
            ) : (
              s.entries[0] && (
                <a
                  href={s.entries[0].source}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full border border-accent px-4 py-1.5 text-accent transition hover:bg-accent hover:text-card"
                >
                  公式の告知を見る
                </a>
              )
            )}
            <a
              href={s.googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted transition hover:text-accent"
            >
              Google マップで開く
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

/** カードの画像。写真（またはMVのサムネイル）があればそれ、無ければ種別の色の枠 */
function Thumb({ spot: s, inactive }: { spot: Spot; inactive: boolean }) {
  const box =
    "relative aspect-[4/3] w-24 shrink-0 overflow-hidden rounded-md sm:w-28";
  if (s.image) {
    return (
      <span className={`${box} bg-line`}>
        <Image
          src={s.image.src}
          alt={s.image.alt}
          fill
          sizes="112px"
          className="object-cover"
        />
      </span>
    );
  }
  const color = inactive ? COLOR.inactive : COLOR[s.category];
  return (
    <span
      className={`${box} flex items-center justify-center text-xs`}
      // 色に透明度を足して淡い背景にする（#rrggbb + 22 = 約13%の濃さ）
      style={{ backgroundColor: `${color}22`, color }}
      aria-hidden
    >
      {/* 種別は横に文字で出ているので、ここは文字を重ねずアイコンだけにする */}
      <svg
        viewBox="0 0 24 24"
        className="size-7"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {s.category === "event" ? (
          // 額縁（展示）
          <>
            <rect x="4" y="5" width="16" height="14" rx="1.5" />
            <path d="M7 16l3.5-4 2.5 3 2-2 2 3" />
          </>
        ) : (
          // 音符（ライブ会場）
          <>
            <path d="M9 18V6l10-2v12" />
            <circle cx="6.5" cy="18" r="2.5" />
            <circle cx="16.5" cy="16" r="2.5" />
          </>
        )}
      </svg>
    </span>
  );
}
