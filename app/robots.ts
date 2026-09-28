import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// robots.txt を生成する。
// 全ページのクロールを許可し、sitemap の場所を検索エンジンに伝える
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
