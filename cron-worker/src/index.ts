// 毎時のニュース収集（/api/cron/collect）を、Cloudflare の Cron Triggers から呼び出す。
//
// 以前は GitHub Actions の schedule で呼んでいたが、混雑時に実行が飛ばされ、
// 毎時のはずが実際は数時間おきになる（配信トレンドで実行履歴とDBから確認した）。
// Cron Triggers は時刻どおりに動く。
//
// 収集の処理そのものはサイト側の API にあり、ここは「時間になったら叩く」だけ。
// 処理を移さないのは、DB や Bluesky の鍵をサイトの1か所に置いたままにするため。

// cron式（wrangler.jsonc の triggers.crons）→ 呼び出すAPI
const JOBS: Record<string, string> = {
  "47 * * * *": "/api/cron/collect",
};

export default {
  async scheduled(controller, env) {
    const path = JOBS[controller.cron];
    if (!path) throw new Error(`未登録のcron式です: ${controller.cron}`);

    const res = await fetch(`${env.SITE_URL}${path}`, {
      headers: { Authorization: `Bearer ${env.CRON_SECRET}` },
      // 転送（3xx）を追わずに失敗として扱う。転送に気づかず
      // 「成功したのにデータが保存されない」状態になるのを防ぐため
      redirect: "manual",
    });

    // 例外にすると Cloudflare のダッシュボードで「失敗」として記録される
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`${path} が失敗しました: ${res.status} ${body.slice(0, 200)}`);
    }
    console.log(`${path} 成功: ${res.status}`);
  },
} satisfies ExportedHandler<Env>;
