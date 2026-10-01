import { CATEGORY_LABEL, type ArticleGroup } from "@/lib/news/view";

// ニュース1行ぶん。/news とトップページで共用する。
// 見出しを押すと元の記事へ（本文はこのサイトには載せない）。

// 区分ごとのバッジの色。公式だけ差し色にして目立たせる
const BADGE: Record<string, string> = {
  official: "border-accent text-accent",
  news: "border-line text-muted",
  fan: "border-line text-muted",
  overseas: "border-line text-muted",
  topic: "border-line text-muted",
};

export function NewsRow({
  group,
  stamp,
}: {
  group: ArticleGroup;
  /**
   * 行の左端に出す文字。/news は日付の見出しで区切るので時刻だけ（09:20）、
   * トップは区切りが無いので「今日」「9月28日（日）」のように日付を出す。
   * 省略すると何も出さない（「話題」タブ）
   */
  stamp?: string;
}) {
  const a = group.main;
  const otherPublishers = group.others
    .map((o) => o.publisher)
    .filter((p): p is string => Boolean(p));

  return (
    <li className="flex gap-3 py-3 sm:gap-4">
      {stamp !== undefined && (
        <span className="w-11 shrink-0 pt-0.5 text-xs tabular-nums text-muted">
          {stamp}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <a
          href={a.url}
          target="_blank"
          rel="noopener noreferrer"
          className="group"
        >
          <span
            className={`mr-2 inline-block rounded border px-1.5 py-px align-[1px] text-[11px] ${BADGE[a.category]}`}
          >
            {CATEGORY_LABEL[a.category]}
          </span>
          <span className="text-[15px] leading-relaxed text-ink transition group-hover:text-accent">
            {a.title}
          </span>
        </a>
        <p className="mt-1 text-xs text-muted">
          {a.publisher}
          {/* 同じニュースを報じた他の媒体。名前はマウスを乗せると見られる */}
          {otherPublishers.length > 0 && (
            <span title={otherPublishers.join("、")}>
              {" "}
              ほか{otherPublishers.length}媒体
            </span>
          )}
          {a.bookmarkCount !== null && a.bookmarkCount > 0 && (
            <span> ・ {a.bookmarkCount}ブックマーク</span>
          )}
        </p>
      </div>
    </li>
  );
}
