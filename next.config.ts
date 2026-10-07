import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // 画像の最適化（縮小・変換）は使わない。Vercel Hobby で月5,000回の上限を超え、
    // アカウントごと30日止められた（2026-10。配信トレンドと共有のアカウント）。
    // YouTube は hqdefault（480px）、Wikimedia は 500px の縮小版を直接読むので、
    // 最適化しなくても十分軽い
    unoptimized: true,
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
