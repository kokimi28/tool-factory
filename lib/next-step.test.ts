/**
 * E11 文脈リンクの妥当性テスト。全 live ツールに「次の一手」があり、遷移先が
 * 実在の live ツール（自分以外）を指すことを固定する（死リンク・自己参照の防止）。
 */
import { describe, it, expect } from "vitest";
import { nextStep } from "./next-step";
import { liveTools, getTool } from "./tools-registry";

describe("E11 文脈リンク（次の一手）", () => {
  it("全 live ツールに next-step があり、live な別ツールを指す", () => {
    for (const t of liveTools()) {
      const ns = nextStep(t.slug);
      expect(ns, `${t.slug} に next-step が無い`).not.toBeNull();
      expect(ns!.slug).not.toBe(t.slug); // 自己参照しない
      const target = getTool(ns!.slug);
      expect(target?.status).toBe("live"); // 死リンクでない
      expect(ns!.label.length).toBeGreaterThan(0);
      expect(ns!.reason.length).toBeGreaterThan(0);
    }
  });

  it("未登録 slug は null（安全側）", () => {
    expect(nextStep("does-not-exist")).toBeNull();
  });
});
