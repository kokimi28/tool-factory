/**
 * tools-registry の整合性テスト（連結の起点が壊れると全ツールのハブ・sitemap・
 * 相互リンクが同時に壊れるため、レジストリの不変条件を CI で固定する）。
 */
import { describe, it, expect } from "vitest";
import {
  TOOLS,
  liveTools,
  getTool,
  relatedTools,
  type Tool,
} from "./tools-registry";

describe("tools-registry の不変条件", () => {
  it("slug は一意（ルート衝突・sitemap 重複を防ぐ）", () => {
    const slugs = TOOLS.map((t) => t.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("slug は URL 安全（英小文字・数字・ハイフンのみ）", () => {
    for (const t of TOOLS) {
      expect(t.slug).toMatch(/^[a-z0-9-]+$/);
    }
  });

  it("各ツールは表示に必要なメタを持つ", () => {
    for (const t of TOOLS) {
      expect(t.name.length).toBeGreaterThan(0);
      expect(t.short.length).toBeGreaterThan(0);
      expect(t.description.length).toBeGreaterThan(0);
      expect(t.cluster).toBe("tax");
      expect(["live", "planned"]).toContain(t.status);
    }
  });

  it("liveTools は status='live' のみを返す", () => {
    expect(liveTools().every((t) => t.status === "live")).toBe(true);
  });

  it("getTool は slug で正しく引ける／無い slug は undefined", () => {
    const first = TOOLS[0];
    expect(getTool(first.slug)?.slug).toBe(first.slug);
    expect(getTool("__does_not_exist__")).toBeUndefined();
  });

  it("relatedTools は自分自身を含まず・公開中のみ（島にしない配線）", () => {
    // 公開中ツールを一時的に想定した純関数の性質を検証する。
    const live = liveTools();
    for (const t of live) {
      const rel = relatedTools(t.slug);
      expect(rel.every((r) => r.slug !== t.slug)).toBe(true);
      expect(rel.every((r) => r.status === "live")).toBe(true);
    }
  });

  it("C0 時点では全ツールが planned（ルート未構築＝ハブは準備中表示）", () => {
    // C1 以降、移行/新規で構築したツールから status を 'live' に切り替える。
    const statuses = new Set(TOOLS.map((t: Tool) => t.status));
    expect(statuses.has("planned")).toBe(true);
  });
});
