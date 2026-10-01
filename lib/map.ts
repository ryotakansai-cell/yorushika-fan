import eventsJson from "@/data/events.json";
import performancesJson from "@/data/live-performances.json";
import venuesJson from "@/data/venues.json";
import { formatDate } from "@/lib/discography";

// 聖地巡礼マップに載せる「場所」を作る。
// 元データは3つに分かれている:
//   live-performances.json … 公演（公式サイトから自動で取り直せる）
//   venues.json            … 会場の座標・閉館情報（人が確かめた値。自動では上書きしない）
//   events.json            … 展示・コラボ（件数が少ないので手で書いている）
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

export type SpotCategory = "live" | "event";

/** 期間のあるもの（展示）の状態。ライブ会場は建物そのものが目的地なので常に null */
export type EventStatus = "upcoming" | "ongoing" | "ended";

export type SpotEntry = {
  title: string;
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

/** 地図に載せる全地点。都道府県（北→南）、同じ県の中は新しい順 */
export function getSpots(): Spot[] {
  const prefIndex = (p: string) => {
    const i = PREFECTURES.indexOf(p);
    return i === -1 ? PREFECTURES.length : i;
  };
  return [...liveSpots(), ...eventSpots(todayInTokyo())].sort(
    (a, b) =>
      prefIndex(a.prefecture) - prefIndex(b.prefecture) ||
      b.latest.localeCompare(a.latest),
  );
}
