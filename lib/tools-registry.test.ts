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

  it("税ツール7種がすべて公開済み（C1 移行3本＋P1〜P4 新規4本）", () => {
    // 新規ツールを planned で追加したらこの一覧に足し、構築できたら live にする。
    const liveSlugs = [
      "taishokukin",
      "ideco",
      "tedori",
      "furusato",
      "jutaku-loan",
      "nenshu-kabe",
      "nenkin-kuriage",
    ];
    for (const slug of liveSlugs) {
      expect(getTool(slug)?.status).toBe("live");
    }
  });

  it("planned のツールにはルートが未実装（ハブは準備中表示）＝現状は planned なし", () => {
    // 現在は全ツール公開済み。将来 planned を足したらこの前提を見直す。
    const planned = TOOLS.filter((t: Tool) => t.status === "planned");
    expect(planned.length).toBe(0);
  });

  // QC3（内部リンク網羅監査）: 全ツールが互いに到達可能であることを固定する。
  // RelatedTools は relatedTools(slug) の結果をそのまま出すため、これが
  // 「自分以外の全公開ツール」と一致する限り、任意のツールから他の全ツールへ
  // 1ホップで到達できる（相互リンクの欠落ゼロ）。将来クラスタ分割や
  // status 変更で相互リンクが欠けたら、この不変条件が CI で赤になる。
  it("各公開ツールの relatedTools は自分以外の全公開ツールと一致（全ツール互いに到達可）", () => {
    const live = liveTools();
    const liveSlugs = live.map((t) => t.slug).sort();
    for (const t of live) {
      const relSlugs = relatedTools(t.slug)
        .map((r) => r.slug)
        .sort();
      const expected = liveSlugs.filter((s) => s !== t.slug);
      expect(relSlugs).toEqual(expected);
    }
  });

  it("相互リンクは対称（A の関連に B があれば B の関連にも A がある）", () => {
    const live = liveTools();
    for (const a of live) {
      for (const b of relatedTools(a.slug)) {
        const back = relatedTools(b.slug).map((r) => r.slug);
        expect(back).toContain(a.slug);
      }
    }
  });
});
