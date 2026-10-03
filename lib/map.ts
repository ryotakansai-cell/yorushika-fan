import eventsJson from "@/data/events.json";
import performancesJson from "@/data/live-performances.json";
import scenesJson from "@/data/scenes.json";
import venuesJson from "@/data/venues.json";
import { formatDate } from "@/lib/discography";

// 聖地巡礼マップに載せる「場所」を作る。
// 元データは3つに分かれている:
//   live-performances.json … 公演（公式サイトから自動で取り直せる）
//   venues.json            … 会場の座標・閉館情報（人が確かめた値。自動では上書きしない）
//   events.json            … 展示・コラボ（件数が少ないので手で書いている）
//   scenes.json            … MVの舞台（出典と根拠の強さを付けて手で書いている）
// ページ側はこの違いを知らなくて済むように、ここで Spot という1つの形にそろえる。

type Performance = {
  live: string;
  date: string | null;
  venue: string;
  source: string;
};

type Venue = {
  name: string;
  lat: number;
  lon: number;
  prefecture: string;
  note?: string;
  currentName?: string;
  closed?: string;
  approximate?: boolean;
};

type EventItem = {
  id: string;
  title: string;
  kind: "exhibition" | "fair" | "collab";
  venue: string;
  address: string;
  prefecture: string;
  lat: number;
  lon: number;
  start: string;
  end: string;
  source: string;
  note?: string;
  periodSource?: string;
};

type SceneItem = {
  id: string;
  name: string;
  prefecture: string;
  lat: number;
  lon: number;
  approximate?: boolean;
  evidence: Evidence;
  /** その場所が出てくる作品。at はMVの何秒目の場面か（分かっているときだけ） */
  scenes: {
    work: string;
    videoId: string;
    at?: number;
    /**
     * 人が場面と現地を見比べて一致を確かめたとき。いつ・何を見て一致としたか。
     * ref は照合に使った写真へのリンク。画像はこのサイトに載せず（権利のため）、元の場所へ案内する
     */
    verified?: {
      date: string;
      how: string;
      ref?: { label: string; url: string };
    };
    /** 場面ごとの注記（MVの駐輪場は建て替えで現存しない、など） */
    note?: string;
    /**
     * この場面だけの写真。同じ場所の2つの場面に同じ写真が並ぶと見比べる楽しさが無いので、
     * 場面に合う写真（下灘駅の夕方の場面には夕方の写真など）を場面ごとに付けられるようにしている
     */
    photo?: PhotoCredit;
    /**
     * Googleマップの埋め込みURL（写真・ストリートビュー）。Googleマップの「共有 → 地図を埋め込む」で得られる。
     * 一般の人がGoogleマップに上げた写真は投稿者に著作権があり、こちらで保存して載せることはできない。
     * 埋め込みはGoogle自身の表示機能で見せるので、画像をコピーせずに現地の様子を見せられる
     */
    embed?: string;
  }[];
  sources: { label: string; url: string }[];
  note?: string;
  /**
   * 巡礼メモ。実際に行く人が知りたいこと（2026-10-03 ファンの巡礼記を調べて項目を決めた）。
   * 巡礼記の文章は写さず、要点を自分の言葉でまとめ、出典を付ける。場所ごとに少しずつ足していく
   */
  memo?: PilgrimMemo;
  /**
   * 地図のピンに使うMVの画像。YouTube が公式に出している4枚
   * （hqdefault＝代表、hq1・hq2・hq3＝動画の途中から自動で取った画像）から、場面に一番近いものを選ぶ。
   * 好きな秒数の画面は公式には取れず、切り抜いてこちらに置くと公式映像の無断複製になるため
   */
  pin?: { videoId: string; frame: "hqdefault" | "hq1" | "hq2" | "hq3" };
  /**
   * カードと見比べ画面に出す現地の写真（Wikimedia Commons の自由ライセンスの写真）。
   * 撮影者名とライセンスを表示する条件で使える。オーナーが候補から選んだものだけ入れる
   * （scripts/commons-candidates.mjs → design/photo-review.html）
   */
  photo?: PhotoCredit;
};

/** 巡礼メモの項目。書ける項目だけ書けばよい */
export type PilgrimMemo = {
  /** 行き方（最寄り駅・本数・駐車場など） */
  access?: string;
  /** おすすめの時間・季節 */
  when?: string;
  /** MVと同じ構図で見るコツ・立ち位置 */
  tips?: string;
  /** MVのころから変わったこと・今の様子 */
  now?: string;
  /** マナー・注意 */
  manners?: string;
  sources: { label: string; url: string }[];
};

/** 自由ライセンスの写真。表示するときは撮影者名・ライセンス・元のページへのリンクを必ず添える */
export type PhotoCredit = {
  thumb: string;
  page: string;
  license: string;
  artist: string;
};

/** カードに出す画像。写真が無い場所は、MVの公式サムネイルで代わりにする */
export type SpotImage = {
  src: string;
  alt: string;
  /** 自由ライセンスの写真のときだけ（MVのサムネイルには付かない） */
  credit?: PhotoCredit;
};

export type SpotCategory = "live" | "event" | "scene";

/**
 * MVの舞台の根拠の強さ（強い順）。
 *   official … 制作者（n-buna・MV監督など）がインタビューなどで場所に触れている
 *              （2026-10-03 時点で「春泥棒」の根川緑道・昭和記念公園だけ）
 *   verified … MVの場面とストリートビューを見比べて一致を確かめた
 *   report   … メディアが記事にしている
 *   estimate … ファンや地域メディアが「モデルでは」としている
 */
export type Evidence = "official" | "verified" | "report" | "estimate";

export const EVIDENCE_LABEL: Record<Evidence, string> = {
  official: "制作者の発言",
  verified: "照合済み",
  report: "報道",
  estimate: "推定",
};

/**
 * 画面にラベルとして出す根拠。2026-10-03 オーナーの判断で「推定」だけ出すことにした
 * （照合済み・報道までラベルにすると、ほとんどの場所に付いて読みにくい）。
 * 「制作者の発言」は公式が場所に触れた唯一の根拠でマップの売りになるので、残している
 */
function shownLabel(e: Evidence) {
  return e === "estimate" || e === "official" ? EVIDENCE_LABEL[e] : undefined;
}

/** 埋め込みはGoogleマップのものだけ受け付ける（別のサイトのページがそのまま表示されるのを防ぐ） */
function checkEmbed(url: string | undefined, where: string) {
  if (url && !url.startsWith("https://www.google.com/maps/embed?")) {
    throw new Error(
      `scenes.json の embed がGoogleマップの埋め込みではありません: ${where}`,
    );
  }
  return url;
}

/** 期間のあるもの（展示）の状態。ライブ会場は建物そのものが目的地なので常に null */
export type EventStatus = "upcoming" | "ongoing" | "ended";

export type SpotEntry = {
  title: string;
  /** MVの舞台だけ: この場面を人が照合して一致を確かめた（何を見て一致としたか） */
  verifiedHow?: string;
  /** 照合に使った写真へのリンク */
  verifiedRef?: { label: string; url: string };
  /** この場面だけの注記 */
  note?: string;
  /** Googleマップの埋め込み（現地の写真・ストリートビュー） */
  embed?: string;
  /** 表示用の日付（例: 2024.11.19・11.20 / 2023.05.09〜05.28） */
  dateLabel: string;
  source: string;
  periodSource?: string;
};

export type Spot = {
  id: string;
  name: string;
  category: SpotCategory;
  /** 「展示」「フェア」「コラボ」「ライブ会場」 */
  kindLabel: string;
  lat: number;
  lon: number;
  prefecture: string;
  address?: string;
  /** 番地まで特定できず、おおよその位置で置いているもの */
  approximate: boolean;
  /** 閉館している会場（行っても建物が無い） */
  closed: boolean;
  status: EventStatus | null;
  note?: string;
  /** 新しい順に並べるための日付（YYYY-MM-DD） */
  latest: string;
  entries: SpotEntry[];
  googleMapsUrl: string;
  /** MVの舞台だけ: 根拠の強さ、出典、現地を見比べるためのストリートビュー */
  evidence?: Evidence;
  /** 「報道」「推定」など。地図の部品はブラウザで動くので、表示名はここで文字にして渡す
   * （部品から EVIDENCE_LABEL を読み込むと、このファイルが読む JSON 一式までブラウザに送られる） */
  evidenceLabel?: string;
  sources?: { label: string; url: string }[];
  streetViewUrl?: string;
  /** カードの画像（今はMVの舞台だけ。ライブ会場・展示は写真が揃ったら足す） */
  image?: SpotImage;
  /** 地図のピンの画像（MVの公式画像のうち、場面に一番近いもの） */
  pinImage?: string;
  /** 見比べ画面（D）へのリンク。MVの舞台だけ */
  detailHref?: string;
  /**
   * 一覧での並び順。MVの舞台だけ scenes.json に書いた順の番号が入る。
   * 北から順にすると、先頭が「きぬ川館本店（廃墟）」になってしまったため、
   * 代表的な場所が先頭に来るよう、データの並びで順番を決められるようにしている
   */
  rank?: number;
};

// 一覧を北から南へ並べるための順番（JISの都道府県コード順）
export const PREFECTURES = [
  "北海道",
  "青森県",
  "岩手県",
  "宮城県",
  "秋田県",
  "山形県",
  "福島県",
  "茨城県",
  "栃木県",
  "群馬県",
  "埼玉県",
  "千葉県",
  "東京都",
  "神奈川県",
  "新潟県",
  "富山県",
  "石川県",
  "福井県",
  "山梨県",
  "長野県",
  "岐阜県",
  "静岡県",
  "愛知県",
  "三重県",
  "滋賀県",
  "京都府",
  "大阪府",
  "兵庫県",
  "奈良県",
  "和歌山県",
  "鳥取県",
  "島根県",
  "岡山県",
  "広島県",
  "山口県",
  "徳島県",
  "香川県",
  "愛媛県",
  "高知県",
  "福岡県",
  "佐賀県",
  "長崎県",
  "熊本県",
  "大分県",
  "宮崎県",
  "鹿児島県",
  "沖縄県",
];

const KIND_LABEL: Record<EventItem["kind"], string> = {
  exhibition: "展示",
  fair: "フェア",
  collab: "コラボ",
};

/** 日本時間の今日（YYYY-MM-DD）。サーバーは UTC で動くので、そのままだと9時間ずれる */
function todayInTokyo() {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo" }).format(
    new Date(),
  );
}

/** 座標で引くと地図アプリでは「ただの地点」になるので、名前で引けるものは名前で引く */
function googleMapsUrl(query: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

function eventSpots(today: string): Spot[] {
  return (eventsJson as EventItem[]).map((e) => {
    const status: EventStatus =
      today < e.start ? "upcoming" : today > e.end ? "ended" : "ongoing";
    return {
      id: `event:${e.id}`,
      name: e.venue,
      category: "event",
      kindLabel: KIND_LABEL[e.kind],
      lat: e.lat,
      lon: e.lon,
      prefecture: e.prefecture,
      address: e.address,
      approximate: false,
      closed: false,
      status,
      note: e.note,
      latest: e.end,
      entries: [
        {
          title: e.title,
          dateLabel: `${formatDate(e.start)}〜${formatDate(
            e.end.slice(0, 4) === e.start.slice(0, 4) ? e.end.slice(5) : e.end,
          )}`,
          source: e.source,
          periodSource: e.periodSource,
        },
      ],
      googleMapsUrl: googleMapsUrl(e.address),
    };
  });
}

/** 「2:03」のような表示 */
function formatSeconds(sec: number) {
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
}

function sceneSpots(): Spot[] {
  return (scenesJson as SceneItem[]).map((sc, rank) => {
    // 照合は場面ごとに記録する。同じ場所でも、確かめていない場面まで「照合済み」に見せないため。
    // 場所としての根拠は、照合済みの場面が1つでもあれば「照合済み」にする
    // ただし制作者の発言は照合より強い根拠なので、照合済みで上書きしない
    const evidence: Evidence =
      sc.evidence !== "official" && sc.scenes.some((x) => x.verified)
        ? "verified"
        : sc.evidence;
    return {
      id: `scene:${sc.id}`,
      name: sc.name,
      category: "scene",
      kindLabel: "MVの舞台",
      lat: sc.lat,
      lon: sc.lon,
      prefecture: sc.prefecture,
      approximate: sc.approximate ?? false,
      closed: false,
      status: null,
      note: sc.note,
      latest: "",
      // 場面の秒数が分かっているものは、その場面から再生されるリンクにする。
      // 画像を切り出して載せるのではなく公式の動画へ飛ばすのは、権利の問題を避けるため
      entries: sc.scenes.map((x) => ({
        title: `${x.work}（MV）`,
        verifiedHow: x.verified?.how,
        verifiedRef: x.verified?.ref,
        note: x.note,
        embed: checkEmbed(x.embed, `${sc.id} ${x.work}`),
        dateLabel:
          x.at !== undefined
            ? `${formatSeconds(x.at)} の場面`
            : "場面の時刻は未確認",
        source: `https://www.youtube.com/watch?v=${x.videoId}${x.at !== undefined ? `&t=${x.at}s` : ""}`,
      })),
      googleMapsUrl: googleMapsUrl(`${sc.lat},${sc.lon}`),
      evidence,
      evidenceLabel: shownLabel(evidence),
      sources: sc.sources,
      // MVの場面と見比べられるよう、その地点のストリートビューを開く（APIキー不要の公式のURL形式）
      streetViewUrl: `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${sc.lat},${sc.lon}`,
      image: sceneImage(sc),
      pinImage: `https://i.ytimg.com/vi/${sc.pin?.videoId ?? sc.scenes[0].videoId}/${sc.pin?.frame ?? "hqdefault"}.jpg`,
      detailHref: `/map/${sc.id}`,
      rank,
    };
  });
}

/**
 * 地図に載せる地点。2026-10-03 から MVの舞台だけ（ライブ会場・展示は /live の一覧に移した）。
 * 並びは scenes.json に書いた順（代表的な場所が先頭）
 */
export function getSpots(): Spot[] {
  return sceneSpots();
}

/** MVページの「この曲の舞台」用。その動画に出てくる場所と場面 */
export type VideoScene = {
  /** マップでその場所を開くための ID（/map#<spotId>） */
  spotId: string;
  /** 見比べ画面（D）へのリンク */
  detailHref: string;
  name: string;
  prefecture: string;
  /** 「2:05」。分かっていないときは undefined */
  atLabel?: string;
  at?: number;
  evidence: Evidence;
  /** 画面に出すラベル（「推定」「制作者の発言」のときだけ） */
  evidenceLabel?: string;
};

export function getScenesForVideo(videoId: string): VideoScene[] {
  return (scenesJson as SceneItem[]).flatMap((sc) =>
    sc.scenes
      .filter((x) => x.videoId === videoId)
      .map((x) => {
        // MVページでは「その場面」が照合済みかで根拠を出す（同じ場所の別の曲の照合は関係ない）
        const evidence: Evidence =
          sc.evidence !== "official" && x.verified ? "verified" : sc.evidence;
        return {
          spotId: `scene:${sc.id}`,
          detailHref: `/map/${sc.id}`,
          name: sc.name,
          prefecture: sc.prefecture,
          at: x.at,
          atLabel: x.at !== undefined ? formatSeconds(x.at) : undefined,
          evidence,
          evidenceLabel: shownLabel(evidence),
        };
      }),
  );
}

/** カードの画像。選んだ写真があればそれ、無ければ最初の場面のMVの公式サムネイル */
function sceneImage(sc: SceneItem): SpotImage {
  if (sc.photo) {
    return { src: sc.photo.thumb, alt: `${sc.name}の写真`, credit: sc.photo };
  }
  const first = sc.scenes[0];
  return {
    src: `https://i.ytimg.com/vi/${first.videoId}/hqdefault.jpg`,
    alt: `${first.work}のMV`,
  };
}

// --------------------------------------------------------------
// 見比べ画面（D）。/map/<id> の単独ページと、地図に重なる画面の両方で使う
// --------------------------------------------------------------

export type SceneDetail = {
  id: string;
  name: string;
  prefecture: string;
  /** 写真も埋め込みも無いとき、航空写真の小さな地図を出すのに使う */
  lat: number;
  lon: number;
  evidenceLabel?: string;
  evidence: Evidence;
  note?: string;
  sources: { label: string; url: string }[];
  photo?: PhotoCredit;
  googleMapsUrl: string;
  streetViewUrl: string;
  scenes: {
    work: string;
    videoId: string;
    at?: number;
    atLabel?: string;
    note?: string;
    embed?: string;
    ref?: { label: string; url: string };
    /** この場面だけの写真（無ければ場所の写真を使う） */
    photo?: PhotoCredit;
  }[];
  memo?: PilgrimMemo;
  /** 近くの聖地（NEARBY_KM 以内。近い順） */
  nearby: { id: string; name: string; distanceLabel: string; works: string }[];
};

/** 「近くの聖地」に出す範囲。歩いて回れるくらい（雨晴の駅・踏切・女岩はこの範囲に入る） */
const NEARBY_KM = 2;

/**
 * 2地点の直線距離（km）。地球を球とみなして緯度・経度から求める一般的な式（ハバーサイン公式）。
 * 数km の範囲なら、実際の距離とのずれは無視できる
 */
function distanceKm(
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

/** 「約350m」「約1.2km」。直線距離なので「約」を付ける */
function formatDistance(km: number) {
  return km < 1
    ? `約${Math.max(50, Math.round((km * 1000) / 50) * 50)}m`
    : `約${km.toFixed(1)}km`;
}

/** 静的に作るページの一覧（generateStaticParams 用） */
export function sceneIds() {
  return (scenesJson as SceneItem[]).map((sc) => sc.id);
}

export function getSceneDetail(id: string): SceneDetail | undefined {
  const sc = (scenesJson as SceneItem[]).find((s) => s.id === id);
  if (!sc) return undefined;
  const evidence: Evidence =
    sc.evidence !== "official" && sc.scenes.some((x) => x.verified)
      ? "verified"
      : sc.evidence;
  return {
    id: sc.id,
    name: sc.name,
    prefecture: sc.prefecture,
    lat: sc.lat,
    lon: sc.lon,
    evidence,
    evidenceLabel: shownLabel(evidence),
    note: sc.note,
    sources: sc.sources,
    photo: sc.photo,
    googleMapsUrl: googleMapsUrl(`${sc.lat},${sc.lon}`),
    streetViewUrl: `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${sc.lat},${sc.lon}`,
    scenes: sc.scenes.map((x) => ({
      work: x.work,
      videoId: x.videoId,
      at: x.at,
      atLabel: x.at !== undefined ? formatSeconds(x.at) : undefined,
      note: x.note,
      embed: checkEmbed(x.embed, `${sc.id} ${x.work}`),
      ref: x.verified?.ref,
      photo: x.photo,
    })),
    memo: sc.memo,
    nearby: (scenesJson as SceneItem[])
      .filter((o) => o.id !== sc.id)
      .map((o) => ({ o, km: distanceKm(sc, o) }))
      .filter(({ km }) => km <= NEARBY_KM)
      .sort((a, b) => a.km - b.km)
      .map(({ o, km }) => ({
        id: o.id,
        name: o.name,
        distanceLabel: formatDistance(km),
        works: [...new Set(o.scenes.map((x) => x.work))].join("・"),
      })),
  };
}

// --------------------------------------------------------------
// ライブ・展示の記録（/live）。2026-10-03 にマップから外して一覧ページにした。
// ライブ会場は他のアーティストにも共通する情報で、「MVの聖地を巡りたい」人には雑音になるため
// --------------------------------------------------------------

export type LiveShow = {
  date: string;
  dateLabel: string;
  venue: string;
  prefecture: string;
  note?: string;
  closed: boolean;
  googleMapsUrl: string;
};

export type LiveTour = {
  live: string;
  first: string;
  periodLabel: string;
  source: string;
  shows: LiveShow[];
};

/** 公演をライブ（ツアー）ごとにまとめる。新しいツアーが上 */
export function getLiveHistory(): LiveTour[] {
  const venues = new Map((venuesJson as Venue[]).map((v) => [v.name, v]));
  const byLive = new Map<string, Performance[]>();
  for (const p of performancesJson as Performance[]) {
    if (!p.date) continue;
    byLive.set(p.live, [...(byLive.get(p.live) ?? []), p]);
  }
  return [...byLive.entries()]
    .map(([live, list]) => {
      const shows = [...list].sort((a, b) => a.date!.localeCompare(b.date!));
      const first = shows[0].date!;
      const last = shows.at(-1)!.date!;
      return {
        live,
        first,
        periodLabel:
          first === last
            ? formatDate(first)
            : `${formatDate(first)}〜${formatDate(
                last.slice(0, 4) === first.slice(0, 4) ? last.slice(5) : last,
              )}`,
        source: shows[0].source,
        shows: shows.map((p) => {
          const v = venues.get(p.venue);
          // 閉館・番地不明の会場は名前で引くと別の場所や「閉業」が出るので座標で引く
          const exact = v && !v.closed && !v.approximate;
          return {
            date: p.date!,
            dateLabel: formatDate(p.date!),
            venue: v?.currentName
              ? `${p.venue}（現 ${v.currentName}）`
              : p.venue,
            prefecture: v?.prefecture ?? "",
            note: v?.note,
            closed: Boolean(v?.closed),
            googleMapsUrl: googleMapsUrl(
              exact
                ? (v.currentName ?? v.name)
                : v
                  ? `${v.lat},${v.lon}`
                  : p.venue,
            ),
          };
        }),
      };
    })
    .sort((a, b) => b.first.localeCompare(a.first));
}

/** 展示・コラボの一覧。新しい順 */
export function getEventHistory(): Spot[] {
  return eventSpots(todayInTokyo()).sort((a, b) =>
    b.latest.localeCompare(a.latest),
  );
}
