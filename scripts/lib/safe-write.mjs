// 取得したデータを JSON に保存する。ただし、前回より件数が大きく減っていたら
// 保存せずにエラーで止める。
//
// なぜ必要か:
// このスクリプトは GitHub Actions で毎日、誰も見ていないところで動く。
// 公式サイトの作りが変わって1件も読み取れなくなったとき、そのまま保存すると
// 空のデータで上書きされ、サイトから作品一覧やMV一覧が消えてしまう。
// エラーで止まれば前回のデータが残り、GitHub から失敗の通知も届く。
import fs from "node:fs";
import path from "node:path";

/**
 * @param {string} file 保存先（例: data/videos.json）
 * @param {unknown[]} items 保存する配列
 * @param {number} minRatio 前回の件数に対して、これを下回ったら止める割合
 */
export function safeWriteJson(file, items, minRatio = 0.8) {
  let previous = 0;
  if (fs.existsSync(file)) {
    try {
      previous = JSON.parse(fs.readFileSync(file, "utf8")).length ?? 0;
    } catch {
      previous = 0; // 前回のファイルが壊れていたら比べようがないので、新しいもので上書きする
    }
  }

  // 動画は公式が非公開にすると減ることがあるので、少しの減少は許す
  if (
    items.length === 0 ||
    (previous > 0 && items.length < previous * minRatio)
  ) {
    console.error(
      `件数が前回より大きく減っています（前回 ${previous}件 → 今回 ${items.length}件）。` +
        `\n取得元の作りが変わった可能性があるため、保存せずに止めました（前回のデータは残っています）。`,
    );
    process.exit(1);
  }

  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(items, null, 2) + "\n");
  console.log(`${file}: 前回 ${previous}件 → 今回 ${items.length}件`);
}
