/**
 * 全ツール横断の記事集約（/articles）の不変条件テスト（QC4）。
 *
 * 集約ハブは「全ツールの記事に1か所から到達できる」ことが価値。ここでレジストリの
 * 公開中ツールと記事集約の整合を CI に固定し、ツール追加時の結線漏れ（新ツールの記事が
 * /articles に載らない＝島化）を回帰で防ぐ。
 */
import { describe, it, expect } from "vitest";
import { allArticles } from "./all-articles";
import { liveTools, getTool } from "./tools-registry";

describe("QC4 全ツール横断の記事集約", () => {
  const cards = allArticles();

  it("記事が1本以上ある", () => {
    expect(cards.length).toBeGreaterThan(0);
  });

  it("各カードの toolSlug は公開中ツール・href は正しい形", () => {
    const liveSlugs = new Set(liveTools().map((t) => t.slug));
    for (const c of cards) {
      expect(liveSlugs.has(c.toolSlug)).toBe(true);
      expect(c.href).toBe(`/${c.toolSlug}/articles/${c.slug}`);
      expect(c.toolName).toBe(getTool(c.toolSlug)?.name);
      expect(c.title.length).toBeGreaterThan(0);
      expect(c.description.length).toBeGreaterThan(0);
      expect(c.updated).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("(toolSlug, slug) は一意（記事の重複掲載なし）", () => {
    const keys = cards.map((c) => `${c.toolSlug}/${c.slug}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("記事を持つ全ての公開中ツールが集約に現れる（結線漏れ＝島化の検知）", () => {
    // 現状は7ツール全てが記事を持つため、公開中ツールが漏れなく集約に載ること。
    const covered = new Set(cards.map((c) => c.toolSlug));
    for (const t of liveTools()) {
      expect(covered.has(t.slug)).toBe(true);
    }
  });

  it("更新日の新しい順に並ぶ", () => {
    for (let i = 1; i < cards.length; i++) {
      expect(cards[i - 1].updated >= cards[i].updated).toBe(true);
    }
  });
});
