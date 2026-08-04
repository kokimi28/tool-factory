/**
 * 見出し階層の点検（QC7・auto-backlog Tier C / アクセシビリティ）。
 *
 * 各ツールのハブページは「h1 がちょうど1つ・先頭が h1・見出しレベルを飛ばさない
 * （h2 の次に h4 等にしない）」ことを満たす必要がある（WCAG 見出し順・スクリーンリーダーの
 * ランドマーク移動が壊れないため）。ページ改修で階層が崩れたら CI で赤くする。
 *
 * 監査対象は liveTools() の各ハブページ（app/(tools)/<slug>/page.tsx）。記事本文ページは
 * 見出しをデータから動的生成するため対象外（本テストはソース上の literal な見出しを検査する）。
 * alt 欠落・フォームのラベル・タブの aria は監査済み（画像なし／wrapping label／role=tablist+aria-selected）で、
 * 回帰しやすい見出し階層をここで固定する。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, it, expect } from "vitest";
import { liveTools } from "./tools-registry";

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));

/** ソース上の <h1>..<h6> を出現順にレベル配列で返す。 */
function headingLevels(src: string): number[] {
  const levels: number[] = [];
  const re = /<h([1-6])[\s>]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) levels.push(Number(m[1]));
  return levels;
}

describe("QC7 見出し階層（各ツールハブページ）", () => {
  for (const tool of liveTools()) {
    const src = readFileSync(
      join(repoRoot, "app", "(tools)", tool.slug, "page.tsx"),
      "utf8",
    );
    const levels = headingLevels(src);

    it(`${tool.slug}: h1 がちょうど1つ・先頭が h1`, () => {
      expect(levels.length).toBeGreaterThan(0);
      expect(levels[0]).toBe(1);
      expect(levels.filter((l) => l === 1).length).toBe(1);
    });

    it(`${tool.slug}: 見出しレベルを飛ばさない`, () => {
      for (let i = 1; i < levels.length; i++) {
        // 深くなるときは前より1段までしか下げない（h2→h4 の飛びを禁止）。浅くなる方向は自由。
        expect(levels[i] - levels[i - 1]).toBeLessThanOrEqual(1);
      }
    });
  }
});
