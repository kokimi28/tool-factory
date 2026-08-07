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

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));

describe("F3 ツールハブのパンくず構造化データ", () => {
  for (const tool of liveTools()) {
    it(`${tool.slug}: ハブページが ToolBreadcrumbJsonLd を出力`, () => {
      const src = readFileSync(
        join(repoRoot, "app", "(tools)", tool.slug, "page.tsx"),
        "utf8",
      );
      expect(src).toMatch(/ToolBreadcrumbJsonLd/);
    });
  }
});
