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
     * Googleマップの埋め込みURL（写真・ストリートビュー）。Googleマップの「共有 → 地図を埋め込む」で得られる。
     * 一般の人がGoogleマップに上げた写真は投稿者に著作権があり、こちらで保存して載せることはできない。
     * 埋め込みはGoogle自身の表示機能で見せるので、画像をコピーせずに現地の様子を見せられる
     */
    embed?: string;
  }[];
  sources: { label: string; url: string }[];
  note?: string;
  /**
   * カードと見比べ画面に出す現地の写真（Wikimedia Commons の自由ライセンスの写真）。
   * 撮影者名とライセンスを表示する条件で使える。オーナーが候補から選んだものだけ入れる
   * （scripts/commons-candidates.mjs → design/photo-review.html）
   */
  photo?: PhotoCredit;
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

/** 同じ年の日付は2つ目以降の年を省いて短くする（2024.11.19・11.20） */
function joinDates(dates: string[]) {
  return dates
    .map((d, i) =>
      i > 0 && d.slice(0, 4) === dates[0].slice(0, 4)
        ? formatDate(d.slice(5))
        : formatDate(d),
    )
    .join("・");
}

/** 座標で引くと地図アプリでは「ただの地点」になるので、名前で引けるものは名前で引く */
function googleMapsUrl(query: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

function liveSpots(): Spot[] {
  const performances = performancesJson as Performance[];
  return (venuesJson as Venue[]).map((v) => {
    const shows = performances
      .filter((p) => p.venue === v.name && p.date)
      .sort((a, b) => a.date!.localeCompare(b.date!));

    // 同じライブの複数日（2日公演など）は1行にまとめる
    const byLive = new Map<string, Performance[]>();
    for (const s of shows) {
      byLive.set(s.live, [...(byLive.get(s.live) ?? []), s]);
    }
    // 新しいライブが上に来るよう、各ライブの初日で並べてから表示用の形にする
    const entries = [...byLive.entries()]
      .sort(([, a], [, b]) => b[0].date!.localeCompare(a[0].date!))
      .map(([live, list]) => ({
        title: live,
        dateLabel: joinDates(list.map((s) => s.date!)),
        source: list[0].source,
      }));

    // 閉館・番地不明の会場は名前で引くと別の場所や「閉業」が出るので座標で引く
    const exact = !v.closed && !v.approximate;
    return {
      id: `live:${v.name}`,
      name: v.currentName ? `${v.name}（現 ${v.currentName}）` : v.name,
      category: "live",
      kindLabel: "ライブ会場",
      lat: v.lat,
      lon: v.lon,
      prefecture: v.prefecture,
      approximate: v.approximate ?? false,
      closed: Boolean(v.closed),
      status: null,
      note: v.note,
      latest: shows.at(-1)?.date ?? "",
      entries,
      googleMapsUrl: googleMapsUrl(
        exact ? (v.currentName ?? v.name) : `${v.lat},${v.lon}`,
      ),
    };
  });
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
      detailHref: `/map/${sc.id}`,
      rank,
    };
  });
}

/** 地図に載せる全地点。都道府県（北→南）、同じ県の中は新しい順 */
export function getSpots(): Spot[] {
  const prefIndex = (p: string) => {
    const i = PREFECTURES.indexOf(p);
    return i === -1 ? PREFECTURES.length : i;
  };
  return [...sceneSpots(), ...liveSpots(), ...eventSpots(todayInTokyo())].sort(
    (a, b) =>
      prefIndex(a.prefecture) - prefIndex(b.prefecture) ||
      b.latest.localeCompare(a.latest),
  );
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
  }[];
};

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
    })),
  };
}
