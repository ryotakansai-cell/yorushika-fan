import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";
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
    {
      url: `${SITE_URL}/discography`,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    { url: `${SITE_URL}/mv`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${SITE_URL}/links`, changeFrequency: "monthly", priority: 0.6 },
  ];

  // 動画ページ。公開日を「最終更新日」として伝える
  const videoPages: MetadataRoute.Sitemap = videos.map((v) => ({
    url: `${SITE_URL}/mv/${v.videoId}`,
    lastModified: new Date(v.publishedAt),
    changeFrequency: "monthly",
    priority: v.kind === "mv" ? 0.8 : 0.6,
  }));

  return [...staticPages, ...videoPages];
}
