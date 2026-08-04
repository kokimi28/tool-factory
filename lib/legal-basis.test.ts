/**
 * 法令根拠・最終確認日の点検（QC10・auto-backlog Tier C）。
 *
 * 各ツールの計算ロジック（lib/<slug>/calculations.ts）は「どの法令・出典に基づくか」と
 * 「いつ確認したか（最終確認日）」をヘッダコメントで必ず残す規約になっている
 * （数字が金になる経路の説明責任＝トレーサビリティ）。この規約が新ツール追加や
 * リファクタで欠けると、根拠不明の数字を配信してしまう。ここで CI に固定し、
 * 根拠コメントの無い calc が入ったらビルド前に赤くする。
 *
 * 監査対象は「公開中の税ツール」= liveTools()。レジストリを正として自動追従する
 * （tools-registry に live を足せば、その calc も自動的にこの点検の対象になる）。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, it, expect } from "vitest";
import { liveTools } from "./tools-registry";

const libDir = dirname(fileURLToPath(import.meta.url));

// 出典として認めるマーカー（いずれか1つ以上を calc ヘッダに含むこと）。
// 法令名・所管省庁・国税庁タックスアンサー等の一次情報を指す語。
const LEGAL_MARKERS = [
  "所得税法",
  "地方税法",
  "租税特別措置法",
  "国税庁",
  "タックスアンサー",
  "日本年金機構",
  "厚生労働省",
  "総務省",
  "出典",
  "適用法令",
];

describe("QC10 法令根拠・最終確認日の点検", () => {
  for (const tool of liveTools()) {
    const path = join(libDir, tool.slug, "calculations.ts");
    const src = readFileSync(path, "utf8");

    it(`${tool.slug}: calc に最終確認日が明記されている`, () => {
      expect(src).toMatch(/最終確認日/);
    });

    it(`${tool.slug}: calc に法令・出典の根拠が明記されている`, () => {
      const hit = LEGAL_MARKERS.some((m) => src.includes(m));
      expect(hit).toBe(true);
    });
  }
});
