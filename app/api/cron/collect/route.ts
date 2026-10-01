import { NextRequest, NextResponse } from "next/server";
import { getDbClient } from "@/lib/db";
import { postNewArticles, type BlueskyReport } from "@/lib/news/bluesky";
import { isRelevant, normalizeUrl } from "@/lib/news/filter";
import { SOURCES, type CollectedItem, type Source } from "@/lib/news/sources";

// 毎回その場で実行する（キャッシュしない）
export const dynamic = "force-dynamic";
// 5つの情報源を取りに行くので、既定の実行時間では足りないことがある
export const maxDuration = 60;

/**
 * GitHub Actions から1時間ごとに呼ばれ、各情報源の記事を集めてDBに貯める。
 *
 * ?dryRun=1 を付けると、保存せずに「何件取れて、何件残るか」だけを返す。
 * フィルタのルールを変えたときに、実データで確かめるため。
 *
 * 保存のあと、新しい記事を Bluesky に投稿する（lib/news/bluesky.ts）。
 * ?bskyPreview=1 を付けると、保存はするが投稿はせず「投稿するならこれ」を返す。
 */
export async function GET(request: NextRequest) {
  // 合言葉（CRON_SECRET）を知っている呼び出し元だけ受け付ける
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "権限がありません" }, { status: 401 });
  }
  const dryRun = request.nextUrl.searchParams.get("dryRun") === "1";
  const bskyPreview = request.nextUrl.searchParams.get("bskyPreview") === "1";

  // ① 全情報源を同時に取りに行く。
  //    allSettled にしているのは、1つが落ちても残りは保存したいため
  //    （all だと1つ失敗した時点で全部が失敗扱いになる）
  const names = Object.keys(SOURCES) as Source[];
  const results = await Promise.allSettled(names.map((n) => SOURCES[n]()));

  const report: Record<string, unknown> = {};
  const keep: CollectedItem[] = [];

  results.forEach((r, i) => {
    const name = names[i];
    if (r.status === "rejected") {
      report[name] = { error: String(r.reason) };
      return;
    }
    // ② 関係の薄い記事・除外リストの記事を落とす
    const relevant = r.value
      .filter(isRelevant)
      .map((it) => ({ ...it, url: normalizeUrl(it.url) }));
    keep.push(...relevant);
    report[name] = {
      fetched: r.value.length,
      kept: relevant.length,
      // 試運転のときは、落とした記事の見出しも見られるようにする
      ...(dryRun && {
        dropped: r.value
          .filter((it) => !isRelevant(it))
          .map((it) => it.title)
          .slice(0, 15),
        sample: relevant.slice(0, 5).map((it) => ({
          title: it.title,
          publisher: it.publisher,
          publishedAt: it.publishedAt,
          category: it.category,
        })),
      }),
    };
  });

  if (dryRun) {
    return NextResponse.json({ dryRun: true, total: keep.length, report });
  }

  // ③ DBに保存する。同じURLが既にあれば新しく作らず、
  //    変わりうる値（タイトル・ブックマーク数）だけ更新する
  const db = getDbClient();
  const now = new Date().toISOString();
  const before = Number(
    (await db.execute("SELECT COUNT(*) AS n FROM articles")).rows[0].n,
  );

  if (keep.length > 0) {
    await db.batch(
      keep.map((it) => ({
        sql: `
          INSERT INTO articles
            (url, source, category, title, publisher, published_at, fetched_at, bookmark_count)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(url) DO UPDATE SET
            title = excluded.title,
            bookmark_count = COALESCE(excluded.bookmark_count, articles.bookmark_count)
        `,
        args: [
          it.url,
          it.source,
          it.category,
          it.title,
          it.publisher,
          it.publishedAt,
          now,
          it.bookmarkCount,
        ],
      })),
      "write",
    );
  }

  const after = Number(
    (await db.execute("SELECT COUNT(*) AS n FROM articles")).rows[0].n,
  );

  // ④ Bluesky に投稿する。失敗しても収集そのものは成功として返す
  //    （投稿の不具合で記事の保存まで止まると、サイトの更新が止まってしまうため）
  let bluesky: BlueskyReport | { error: string };
  try {
    bluesky = await postNewArticles(bskyPreview);
  } catch (e) {
    bluesky = { error: String(e) };
  }

  return NextResponse.json({
    collectedAt: now,
    saved: keep.length,
    newArticles: after - before,
    totalArticles: after,
    report,
    bluesky,
  });
}
