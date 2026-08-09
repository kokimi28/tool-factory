/**
 * 年金月額プリセットの妥当性テスト（E2）。プリセット値で各シナリオ計算が破綻しないことを固定。
 */
import { describe, it, expect } from "vitest";
import { PENSION_MONTHLY_PRESETS } from "./presets";
import { pensionScenario } from "./calculations";

describe("E2 nenkin-kuriage 月額プリセット", () => {
  it("プリセットは2件以上・ラベル非空・正の整数", () => {
    expect(PENSION_MONTHLY_PRESETS.length).toBeGreaterThanOrEqual(2);
    for (const p of PENSION_MONTHLY_PRESETS) {
      expect(p.label.length).toBeGreaterThan(0);
      expect(Number.isInteger(p.value)).toBe(true);
      expect(p.value).toBeGreaterThan(0);
    }
  });

  it("プリセット値は昇順（UI の並び）", () => {
    for (let i = 1; i < PENSION_MONTHLY_PRESETS.length; i++) {
      expect(PENSION_MONTHLY_PRESETS[i].value).toBeGreaterThan(PENSION_MONTHLY_PRESETS[i - 1].value);
    }
  });

  it("各プリセットで 70歳受給（増額）の月額は 65歳基準を上回る", () => {
    for (const p of PENSION_MONTHLY_PRESETS) {
      const at65 = pensionScenario(p.value, 65).monthly;
      const at70 = pensionScenario(p.value, 70).monthly;
      expect(at65).toBe(p.value);
      expect(at70).toBeGreaterThan(at65);
    }
  });
});
