/**
 * ツールハブページのパンくず構造化データ点検（F3・2巡目）。
 * 各公開ツールのハブページが BreadcrumbList（ToolBreadcrumbJsonLd）を出力することを CI 固定。
 * 記事ページは QC5 で BreadcrumbList 済み。ページ改修で構造化データが欠けたら赤くする。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, it, expect } from "vitest";
import { liveTools } from "./tools-registry";
import { TOOL_HOWTO } from "./tool-howto";

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));

describe("F3 ツールハブの構造化データ（BreadcrumbList / HowTo）", () => {
  for (const tool of liveTools()) {
    const src = readFileSync(
      join(repoRoot, "app", "(tools)", tool.slug, "page.tsx"),
      "utf8",
    );

    it(`${tool.slug}: ハブページが ToolBreadcrumbJsonLd を出力`, () => {
      expect(src).toMatch(/ToolBreadcrumbJsonLd/);
    });

    it(`${tool.slug}: ハブページが ToolHowToJsonLd を出力`, () => {
      expect(src).toMatch(/ToolHowToJsonLd/);
    });

    it(`${tool.slug}: HowTo 手順データが存在（2手順以上）`, () => {
      const howto = TOOL_HOWTO[tool.slug];
      expect(howto).toBeDefined();
      expect(howto.name.length).toBeGreaterThan(0);
      expect(howto.steps.length).toBeGreaterThanOrEqual(2);
      for (const s of howto.steps) {
        expect(s.name.length).toBeGreaterThan(0);
        expect(s.text.length).toBeGreaterThan(0);
      }
    });
  }
});
