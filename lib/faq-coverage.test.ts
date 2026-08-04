/**
 * FAQ 網羅の点検（QC2・auto-backlog Tier C）。
 *
 * 各ツールのページは FAQ を最低5問持ち、FAQPage 構造化データとして出力する規約
 * （SEO の主要導線＝リッチリザルト対象）。FAQ が5問未満に減ると規約割れになるため、
 * ここで CI に固定する。6ツールはページ内の FAQ_ITEMS 配列、tedori は lib/tedori/faq の
 * 共有配列を数える（データの持ち方の違いを吸収して同じ閾値で検査する）。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, it, expect } from "vitest";
import { FAQ_ITEMS as TEDORI_FAQ } from "./tedori/faq";

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const MIN_FAQ = 5;

// ページ内に FAQ_ITEMS をインライン定義する6ツール（`q:` 行を1問として数える）。
const INLINE_FAQ_TOOLS = [
  "taishokukin",
  "ideco",
  "furusato",
  "jutaku-loan",
  "nenshu-kabe",
  "nenkin-kuriage",
];

describe("QC2 FAQ 網羅（各ツール最低5問）", () => {
  for (const slug of INLINE_FAQ_TOOLS) {
    it(`${slug}: FAQ が ${MIN_FAQ} 問以上`, () => {
      const src = readFileSync(
        join(repoRoot, "app", "(tools)", slug, "page.tsx"),
        "utf8",
      );
      const count = (src.match(/^\s*q:\s*["'`]/gm) ?? []).length;
      expect(count).toBeGreaterThanOrEqual(MIN_FAQ);
    });
  }

  it(`tedori: 共有 FAQ_ITEMS が ${MIN_FAQ} 問以上`, () => {
    expect(TEDORI_FAQ.length).toBeGreaterThanOrEqual(MIN_FAQ);
  });
});
