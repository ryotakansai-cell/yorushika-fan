import type { MetadataRoute } from "next";
import { sceneIds } from "@/lib/map";
import { SITE_URL } from "@/lib/site";
import { songs } from "@/lib/songs";
import { videos } from "@/lib/videos";

// sitemap.xml を自動生成する。
// 検索エンジンに「このサイトにはどんなURLがあるか」を一覧で渡す仕組み。
// 動画ページは78本あり、トップから全部に辿れるわけではないので、
// 一覧を渡さないと見つけてもらえない。
//
// データはJSONなので、ページと同じくビルド時に一度だけ作られる。
export default function sitemap(): MetadataRoute.Sitemap {
  const staticPages: MetadataRoute.Sitemap = [
    { url: SITE_URL, changeFrequency: "weekly", priority: 1 },
    // 1時間ごとに記事が増えるページ
    { url: `${SITE_URL}/news`, changeFrequency: "hourly", priority: 0.9 },
    {
      url: `${SITE_URL}/discography`,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    { url: `${SITE_URL}/songs`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${SITE_URL}/mv`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${SITE_URL}/map`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${SITE_URL}/elma`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE_URL}/quiz`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE_URL}/live`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE_URL}/links`, changeFrequency: "monthly", priority: 0.6 },
  ];

  // 動画ページ。公開日を「最終更新日」として伝える
  const videoPages: MetadataRoute.Sitemap = videos.map((v) => ({
    url: `${SITE_URL}/mv/${v.videoId}`,
    lastModified: new Date(v.publishedAt),
    changeFrequency: "monthly",
    priority: v.kind === "mv" ? 0.8 : 0.6,
  }));

  // 聖地の見比べページ。「夜行 聖地」のような検索から直接来てもらうためのページ
  const scenePages: MetadataRoute.Sitemap = sceneIds().map((id) => ({
    url: `${SITE_URL}/map/${id}`,
    changeFrequency: "monthly",
    priority: 0.7,
  }));

  // 曲ごとのページ。「曲名 MV」「曲名 聖地」のような検索の入口
  const songPages: MetadataRoute.Sitemap = songs.map((s) => ({
    url: `${SITE_URL}/songs/${s.id}`,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  return [...staticPages, ...songPages, ...videoPages, ...scenePages];
}
