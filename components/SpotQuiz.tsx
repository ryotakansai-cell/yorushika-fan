"use client";

import "leaflet/dist/leaflet.css";
import type { LayerGroup, Map as LeafletMap } from "leaflet";
import { useEffect, useRef, useState } from "react";
import { LiteYouTube } from "@/components/LiteYouTube";
import { ScenePlayer } from "@/components/ScenePlayer";
import { distanceKm, formatDistance } from "@/lib/geo";
import type { QuizQuestion } from "@/lib/map";

// 聖地クイズの本体。MVの場面（その秒数で止めた状態）やジャケットを見て、地図をクリックして場所を当てる。
// 正解との距離で点数を出し、答え合わせでは正解の場所と、自分の答えから正解までの線を見せる。
//
// 問題は毎回ランダムに5問。ランダムはブラウザで「はじめる」を押したときに選ぶ
// （サーバーで選ぶと、作ったときの5問に固定されてしまう。ページは静的に作っているため）。

const ROUNDS = 5;
const MAX_POINTS = 1000;
/**
 * 点数の付け方: 1000点 × e^(−距離/100km)。10km ずれで約900点、50kmで約600点、200kmで約140点。
 * 県まで合っていれば半分くらい取れて、ぴったりなら満点に近い、という手応えになるよう、実際に試して決めた
 */
const SCALE_KM = 100;
/** これより近ければ満点（ピンの太さぶんのずれで点が減らないように） */
const PERFECT_KM = 0.3;

const BEST_KEY = "yorushika-quiz-best";

// 色は globals.css と合わせている（Leaflet は CSS 変数を読めないので値で書く）
const ACCENT = "#3d6485";
const INK = "#262626";

/**
 * 地域ごとの最初の表示範囲。問題の場所に合わせて寄せると答えのヒントになるので、国全体を見せる。
 * 日本は沖縄から北海道まで、スウェーデンは南端のマルメから北部まで
 */
const AREA_BOUNDS: Record<string, [[number, number], [number, number]]> = {
  日本: [
    [24, 123],
    [45.6, 146],
  ],
  スウェーデン: [
    [55.3, 11],
    [69, 24.2],
  ],
};

type Result = { q: QuizQuestion; km: number; points: number };

function scoreOf(km: number) {
  if (km < PERFECT_KM) return MAX_POINTS;
  return Math.round(MAX_POINTS * Math.exp(-km / SCALE_KM));
}

/** 同じ場所が2回出ないように、場所ごとに1問だけ選んでから混ぜる */
function pickQuestions(all: QuizQuestion[]) {
  const shuffled = [...all].sort(() => Math.random() - 0.5);
  const seen = new Set<string>();
  const picked: QuizQuestion[] = [];
  for (const q of shuffled) {
    if (seen.has(q.spotId)) continue;
    seen.add(q.spotId);
    picked.push(q);
    if (picked.length === ROUNDS) break;
  }
  return picked;
}

function readBest() {
  try {
    return Number(localStorage.getItem(BEST_KEY)) || 0;
  } catch {
    return 0;
  }
}

export function SpotQuiz({ questions }: { questions: QuizQuestion[] }) {
  const [round, setRound] = useState<QuizQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [guess, setGuess] = useState<[number, number] | null>(null);
  const [results, setResults] = useState<Result[]>([]);
  const [phase, setPhase] = useState<"intro" | "playing" | "done">("intro");
  const [best, setBest] = useState(0);
  const [mapReady, setMapReady] = useState(false);

  const mapBox = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const layerRef = useRef<LayerGroup | null>(null);
  const leafletRef = useRef<typeof import("leaflet") | null>(null);
  // 地図のクリックは Leaflet の世界で起きるので、今が答える前かどうかを ref で渡す
  const answeredRef = useRef(false);

  const q = round[index];
  const answered = results.length > index;
  useEffect(() => {
    answeredRef.current = answered;
  }, [answered]);

  function start() {
    setRound(pickQuestions(questions));
    setIndex(0);
    setGuess(null);
    setResults([]);
    setPhase("playing");
  }

  // ① 遊んでいる間だけ地図を作る（終わったら片付ける）
  useEffect(() => {
    if (phase !== "playing") return;
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !mapBox.current) return;
      const map = L.map(mapBox.current, { zoomSnap: 0.5 });
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>',
        maxZoom: 19,
      }).addTo(map);
      // 地図のクリックで答えを置く（答え合わせの後は動かせない）
      map.on("click", (e) => {
        if (answeredRef.current) return;
        setGuess([e.latlng.lat, e.latlng.lng]);
      });
      leafletRef.current = L;
      layerRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;
      setMapReady(true);
    })();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      layerRef.current = null;
      setMapReady(false);
    };
  }, [phase]);

  // ② 問題が変わったら、印を消して国全体を見せる
  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map || !q) return;
    layerRef.current?.clearLayers();
    map.fitBounds(AREA_BOUNDS[q.area] ?? AREA_BOUNDS["日本"]);
  }, [mapReady, q]);

  // ③ 自分の答え（印）と、答え合わせの後の正解・線を描く
  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!L || !map || !layer || !q) return;
    layer.clearLayers();
    if (guess) {
      L.circleMarker(guess, {
        radius: 8,
        color: "#fff",
        weight: 2,
        fillColor: ACCENT,
        fillOpacity: 1,
      })
        .bindTooltip("あなたの答え")
        .addTo(layer);
    }
    if (answered) {
      const answer: [number, number] = [q.lat, q.lon];
      L.circleMarker(answer, {
        radius: 9,
        color: "#fff",
        weight: 2,
        fillColor: INK,
        fillOpacity: 1,
      })
        .bindTooltip(`正解：${q.name}`, { permanent: true, direction: "top" })
        .addTo(layer);
      if (guess) {
        L.polyline([guess, answer], {
          color: ACCENT,
          weight: 2,
          dashArray: "4 6",
        }).addTo(layer);
        map.fitBounds(L.latLngBounds([guess, answer]), {
          padding: [40, 40],
          maxZoom: 14,
        });
      }
    }
  }, [guess, answered, q]);

  function submit() {
    if (!q || !guess) return;
    const km = distanceKm(
      { lat: guess[0], lon: guess[1] },
      { lat: q.lat, lon: q.lon },
    );
    setResults((r) => [...r, { q, km, points: scoreOf(km) }]);
  }

  function next() {
    if (index + 1 < round.length) {
      setIndex(index + 1);
      setGuess(null);
      return;
    }
    // 最後の問題: 合計を出し、自己ベストなら覚えておく（このブラウザの中だけ）
    // 自己ベストは結果を出すときに読む（ページを開いた時点で読むと、サーバーで作った画面と食い違うため）
    const total = results.reduce((n, r) => n + r.points, 0);
    const prev = readBest();
    setBest(Math.max(prev, total));
    if (total > prev) {
      try {
        localStorage.setItem(BEST_KEY, String(total));
      } catch {
        // 保存できない環境（プライベートモードなど）でも遊べればよい
      }
    }
    setPhase("done");
  }

  const total = results.reduce((n, r) => n + r.points, 0);
  const last = results[index];

  if (phase === "intro") {
    return (
      <div className="rounded-lg border border-line bg-card px-5 py-6">
        <p className="text-sm leading-relaxed text-ink">
          MVの場面やジャケットを見て、それがどこなのかを地図をクリックして当ててください。
          全{ROUNDS}問、正解に近いほど点が高く、1問{MAX_POINTS}点満点です。
        </p>
        <p className="mt-1 text-xs text-muted">
          問題はマップに載っている{questions.length}
          の場面から毎回ランダムに出ます。
        </p>
        <button
          type="button"
          onClick={start}
          className="mt-4 rounded-full bg-accent px-6 py-2 text-card transition hover:opacity-90"
        >
          はじめる
        </button>
      </div>
    );
  }

  if (phase === "done") {
    const shareText = `ヨルシカ聖地クイズで ${total} / ${ROUNDS * MAX_POINTS}点でした`;
    const url =
      typeof window === "undefined" ? "" : `${window.location.origin}/quiz`;
    return (
      <div className="rounded-lg border border-line bg-card px-5 py-6">
        <p className="text-sm text-muted">結果</p>
        <p className="mt-1 font-serif text-4xl tabular-nums text-ink">
          {total}
          <span className="ml-1 text-base text-muted">
            / {ROUNDS * MAX_POINTS}点
          </span>
        </p>
        <p className="mt-1 text-xs text-muted">
          {total >= best ? "自己ベスト！" : `自己ベスト：${best}点`}
        </p>

        <ol className="mt-5 divide-y divide-line border-y border-line text-sm">
          {results.map((r, i) => (
            <li
              key={r.q.key}
              className="flex flex-wrap items-baseline gap-x-3 py-2"
            >
              <span className="w-6 tabular-nums text-muted">{i + 1}</span>
              <a
                href={`/map/${r.q.spotId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-serif text-ink transition hover:text-accent"
              >
                {r.q.name}
              </a>
              <span className="text-xs text-muted">{r.q.work}</span>
              <span className="ml-auto tabular-nums text-muted">
                {formatDistance(r.km)}・{r.points}点
              </span>
            </li>
          ))}
        </ol>

        <div className="mt-5 flex flex-wrap gap-2 text-sm">
          <button
            type="button"
            onClick={start}
            className="rounded-full bg-accent px-5 py-1.5 text-card transition hover:opacity-90"
          >
            もう一度
          </button>
          {/* 結果を SNS に書けるように。投稿画面を開くだけで、勝手には投稿しない */}
          <a
            href={`https://twitter.com/intent/tweet?${new URLSearchParams({ text: shareText, url, hashtags: "ヨルシカ" })}`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full border border-line px-5 py-1.5 text-ink transition hover:border-accent hover:text-accent"
          >
            X に結果を書く
          </a>
          <a
            href={`https://bsky.app/intent/compose?${new URLSearchParams({ text: `${shareText}\n${url}\n#ヨルシカ` })}`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full border border-line px-5 py-1.5 text-ink transition hover:border-accent hover:text-accent"
          >
            Bluesky に結果を書く
          </a>
        </div>
      </div>
    );
  }

  // 遊んでいる最中: 左（スマホは上）に問題、右（スマホは下）に地図
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <p className="font-serif text-lg text-ink">
          第{index + 1}問
          <span className="ml-1 text-sm text-muted">/ {round.length}</span>
        </p>
        <p className="text-sm tabular-nums text-muted">{total}点</p>
      </div>

      {/* スマホは「問題 → 地図 → 答え合わせとボタン」の順に縦に並べる（地図に答えを置いて、すぐ下で決定できるように）。
          PCは左に問題と答え合わせ、右に地図を2段ぶんの高さで置く */}
      <div className="mt-3 grid gap-4 lg:grid-cols-2 lg:grid-rows-[auto_1fr]">
        <div className="lg:col-start-1 lg:row-start-1">
          {q && (
            <>
              <div className="overflow-hidden rounded-lg border border-line bg-ink">
                {/* 問題が変わったら作り直す（key）。前の問題の場面が一瞬残らないように */}
                {q.videoId && q.at !== undefined ? (
                  <ScenePlayer
                    key={q.key}
                    videoId={q.videoId}
                    start={q.at}
                    title={`${q.work}（MV）`}
                  />
                ) : q.jacketVideo ? (
                  <LiteYouTube
                    key={q.key}
                    videoId={q.jacketVideo}
                    title={`『${q.work}』のジャケット（公式音源）`}
                    sizes="(min-width: 1024px) 480px, 100vw"
                  />
                ) : null}
              </div>
              <p className="mt-2 text-sm text-ink">
                {q.jacketVideo
                  ? `『${q.work}』のジャケット写真の場所は、${q.area}のどこ？`
                  : `「${q.work}」のMVのこの場面は、${q.area}のどこ？`}
              </p>
              <p className="mt-1 text-xs text-muted">
                地図をクリックして答えを置き、「ここにする」を押してください。拡大・移動もできます。
              </p>
            </>
          )}
        </div>

        <div
          ref={mapBox}
          className="relative z-0 h-[45vh] w-full overflow-hidden rounded-lg border border-line bg-card lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:h-[70vh]"
          aria-label="答えを置く地図"
        />

        <div className="lg:col-start-1 lg:row-start-2">
          {/* 答え合わせ */}
          {answered && last && (
            <div className="mt-4 rounded-lg border border-line bg-card px-4 py-3">
              <p className="text-sm text-muted">
                正解は{" "}
                <a
                  href={`/map/${last.q.spotId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-serif text-base text-ink transition hover:text-accent"
                >
                  {last.q.name}
                </a>
                （{last.q.place}）
                {last.q.evidenceLabel && (
                  <span className="ml-1 rounded border border-line px-1.5 py-px text-xs">
                    {last.q.evidenceLabel}
                  </span>
                )}
              </p>
              <p className="mt-1 text-sm text-ink">
                あなたの答えとの距離 {formatDistance(last.km)}・
                <span className="font-serif text-lg tabular-nums">
                  {last.points}
                </span>
                点
              </p>
            </div>
          )}

          <div className="mt-4">
            {answered ? (
              <button
                type="button"
                onClick={next}
                className="rounded-full bg-accent px-6 py-2 text-card transition hover:opacity-90"
              >
                {index + 1 < round.length ? "次の問題" : "結果を見る"}
              </button>
            ) : (
              <button
                type="button"
                onClick={submit}
                disabled={!guess}
                className="rounded-full bg-accent px-6 py-2 text-card transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                ここにする
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
