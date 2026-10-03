import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // YouTubeのサムネイル（i.ytimg.com）を next/image で最適化して表示するための許可。
    // 許可したドメイン以外の画像は next/image が拒否する（勝手な画像の中継を防ぐため）
    // upload.wikimedia.org は、聖地巡礼マップのカードに使う Wikimedia Commons の写真
    remotePatterns: [
      { protocol: "https", hostname: "i.ytimg.com" },
      { protocol: "https", hostname: "upload.wikimedia.org" },
      // Commons の縮小画像はこちらのドメインで返ってくる（upload だけだと表示できずページがエラーになった）
      { protocol: "https", hostname: "thumb.wikimedia.org" },
    ],
  },
};

export default nextConfig;
