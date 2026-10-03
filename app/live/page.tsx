import type { Metadata } from "next";
import Link from "next/link";
import { getEventHistory, getLiveHistory } from "@/lib/map";

export const metadata: Metadata = {
  alternates: { canonical: "/live" },
  title: "ライブ・展示の記録",
  description:
    "ヨルシカのライブ・ツアーの日程と会場、展示・コラボの開催場所の一覧。公式サイトの告知を出典にしています。",
};

// 展示の「開催中・終了」は今日の日付で決まるので、1日1回作り直す
export const revalidate = 86400;

// ライブ会場と展示は、2026-10-03 に聖地巡礼マップから外してこのページにまとめた。
// 会場は他のアーティストにも共通する情報で、地図に並べると「MVの聖地を巡りたい」人には雑音になるため。
// 公演の日程そのものは記録として価値があるので、ツアーごとの一覧で残している

export default function LivePage() {
  const tours = getLiveHistory();
  const events = getEventHistory();
  const showCount = tours.reduce((n, t) => n + t.shows.length, 0);

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-10">
      <h1 className="font-serif text-2xl text-ink">ライブ・展示の記録</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        ライブ {tours.length} 本（{showCount} 公演）と、展示・コラボ{" "}
        {events.length}{" "}
        件の記録です。いずれも公式サイトの告知を出典にしています。MVの舞台は
        <Link href="/map" className="text-ink transition hover:text-accent">
          聖地巡礼マップ
        </Link>
        で見られます。
      </p>

      <section className="mt-10">
        <h2 className="font-serif text-xl text-ink">ライブ・ツアー</h2>
        {tours.map((t) => (
          <section key={t.live} className="mt-6">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 border-b border-line pb-2">
              <a
                href={t.source}
                target="_blank"
                rel="noopener noreferrer"
                className="font-serif text-ink transition hover:text-accent"
              >
                {t.live}
              </a>
              <span className="text-xs tabular-nums text-muted">
                {t.periodLabel}
              </span>
            </div>
            <ul className="divide-y divide-line text-sm">
              {t.shows.map((s) => (
                <li
                  key={`${s.date}-${s.venue}`}
                  className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 py-2"
                >
                  <span className="w-20 shrink-0 tabular-nums text-muted">
                    {s.dateLabel}
                  </span>
                  <a
                    href={s.googleMapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-ink transition hover:text-accent"
                  >
                    {s.venue}
                  </a>
                  <span className="text-xs text-muted">{s.prefecture}</span>
                  {s.closed && (
                    <span className="rounded bg-line px-1.5 py-px text-xs text-muted">
                      閉館
                    </span>
                  )}
                  {s.note && (
                    <span className="basis-full pl-[5.75rem] text-xs text-muted">
                      {s.note}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </section>

      <section className="mt-14">
        <h2 className="font-serif text-xl text-ink">展示・コラボ</h2>
        <ul className="mt-3 divide-y divide-line border-y border-line text-sm">
          {events.map((e) => {
            const entry = e.entries[0];
            const status =
              e.status === "ended"
                ? "終了"
                : e.status === "ongoing"
                  ? "開催中"
                  : "開催予定";
            return (
              <li key={e.id} className="py-3">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="tabular-nums text-xs text-muted">
                    {entry.dateLabel}
                  </span>
                  <span
                    className={`rounded px-1.5 py-px text-xs ${
                      e.status === "ended"
                        ? "bg-line text-muted"
                        : "bg-accent text-card"
                    }`}
                  >
                    {status}
                  </span>
                </div>
                <a
                  href={entry.source}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 block text-ink transition hover:text-accent"
                >
                  {entry.title}
                </a>
                <p className="mt-0.5 text-xs text-muted">
                  <a
                    href={e.googleMapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="transition hover:text-accent"
                  >
                    {e.name}
                  </a>
                  （{e.address}）
                </p>
                {e.note && (
                  <p className="mt-0.5 text-xs text-muted">{e.note}</p>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </main>
  );
}
