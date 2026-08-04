/**
 * 免責表示の網羅（QC9・auto-backlog Tier C）。
 *
 * 各ツールの計算結果には「概算・参考値である」旨の免責を必ず表示する規約
 * （税額の断定を避ける・誤解防止＝金になる経路の説明責任）。結果を描画する
 * コンポーネントから免責が消えると規約割れになるため、ここで CI に固定する。
 *
 * 監査対象は liveTools() を正とし、各ツールの components/<slug>/ 配下のいずれかの
 * ファイルに免責マーカー（概算 / 参考値）が含まれることを確認する（結果コンポーネントの
 * ファイル名がツールごとに違う＝Calculator.tsx / ResultDisplay.tsx を吸収）。
 * なお全ページ共通フッター（SiteFooter）にも免責があり二重の保険になっている。
 */
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, it, expect } from "vitest";
import { liveTools } from "./tools-registry";

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const DISCLAIMER = /概算|参考値/;

describe("QC9 免責表示の網羅（全ツールの結果に概算・参考値の明示）", () => {
  for (const tool of liveTools()) {
    it(`${tool.slug}: 結果コンポーネントに免責表示がある`, () => {
      const dir = join(repoRoot, "components", tool.slug);
      const files = readdirSync(dir).filter((f) => f.endsWith(".tsx"));
      const hasDisclaimer = files.some((f) =>
        DISCLAIMER.test(readFileSync(join(dir, f), "utf8")),
      );
      expect(hasDisclaimer).toBe(true);
    });
  }
});
