"use client";

import { useEffect, useRef } from "react";

// 聖地の見比べ画面で使う、「その場面で止まった状態」で表示する YouTube プレーヤー。
//
// 普通の埋め込みは、再生するまで動画の代表画像（サムネイル）しか出ない。
// それだと見比べたい場面が見えないし、再生すると一瞬で場面が過ぎてしまう（オーナーの指摘）。
// そこで YouTube 公式の IFrame Player API で、次の順に動かす:
//   1. 音を消して、その秒数から自動で再生を始める（音が出ない自動再生はブラウザが許可している）
//   2. 再生が始まった瞬間に一時停止し、ずれた分を戻すためにその秒数へ移動し直す
//   3. 音を戻す（止まっているので鳴らない。利用者が押したときに音付きで再生される）
// 自動再生がブラウザに止められた場合は、サムネイルのまま。押せばその秒数から再生される。

type YTPlayer = {
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  unMute(): void;
  destroy(): void;
};

type YTNamespace = {
  Player: new (
    el: HTMLElement,
    opts: {
      videoId: string;
      host?: string;
      playerVars?: Record<string, number>;
      events?: {
        onStateChange?: (e: { data: number; target: YTPlayer }) => void;
      };
    },
  ) => YTPlayer;
  PlayerState: { PLAYING: number };
};

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

/** API のスクリプトはページに1回だけ読み込む（プレーヤーが複数あっても共有する） */
let apiPromise: Promise<YTNamespace> | null = null;
function loadApi(): Promise<YTNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  apiPromise ??= new Promise((resolve) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve(window.YT!);
    };
    const s = document.createElement("script");
    s.src = "https://www.youtube.com/iframe_api";
    document.head.append(s);
  });
  return apiPromise;
}

export function ScenePlayer({
  videoId,
  start,
  title,
}: {
  videoId: string;
  start: number;
  title: string;
}) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let player: YTPlayer | null = null;
    let cancelled = false;
    // API が差し替える要素は、React が管理する要素とは別にしておく
    // （React の要素を直接 iframe に置き換えられると、後片付けで食い違いが起きる）
    const target = document.createElement("div");
    hostRef.current?.append(target);

    loadApi().then((YT) => {
      if (cancelled) return;
      let paused = false;
      player = new YT.Player(target, {
        videoId,
        // 再生ボタンを押すまで閲覧履歴用の Cookie を置かない版の YouTube
        host: "https://www.youtube-nocookie.com",
        playerVars: {
          start,
          autoplay: 1,
          mute: 1,
          playsinline: 1, // iPhone で全画面にならず、その場で再生する
          rel: 0,
        },
        events: {
          onStateChange: (e) => {
            if (paused || e.data !== YT.PlayerState.PLAYING) return;
            paused = true;
            e.target.pauseVideo();
            e.target.seekTo(start, true);
            e.target.unMute();
          },
        },
      });
    });

    return () => {
      cancelled = true;
      player?.destroy();
      target.remove();
    };
  }, [videoId, start]);

  return (
    <div
      ref={hostRef}
      title={title}
      // API が作る iframe を枠いっぱいに広げる
      className="aspect-video w-full [&_iframe]:h-full [&_iframe]:w-full"
    />
  );
}
