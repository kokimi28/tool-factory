/**
 * 本人の年収プリセットの妥当性テスト（E2）。プリセット値で壁計算が破綻しないことを固定。
 */
import { describe, it, expect } from "vitest";
import { NENSHU_KABE_PRESETS } from "./presets";
import { takeHomeWithWall, SOCIAL_INSURANCE_WALLS } from "./calculations";

describe("E2 nenshu-kabe 年収プリセット", () => {
  it("プリセットは2件以上・ラベル非空・正の整数", () => {
    expect(NENSHU_KABE_PRESETS.length).toBeGreaterThanOrEqual(2);
    for (const p of NENSHU_KABE_PRESETS) {
      expect(p.label.length).toBeGreaterThan(0);
      expect(Number.isInteger(p.value)).toBe(true);
      expect(p.value).toBeGreaterThan(0);
    }
  });

  it("プリセット値は昇順（UI の並び）", () => {
    for (let i = 1; i < NENSHU_KABE_PRESETS.length; i++) {
      expect(NENSHU_KABE_PRESETS[i].value).toBeGreaterThan(NENSHU_KABE_PRESETS[i - 1].value);
    }
  });

  it("各プリセットで 130万の壁の手取りは 0〜年収の範囲に収まる", () => {
    for (const p of NENSHU_KABE_PRESETS) {
      const r = takeHomeWithWall(p.value, SOCIAL_INSURANCE_WALLS.standard);
      expect(r.takeHome).toBeGreaterThan(0);
      expect(r.takeHome).toBeLessThanOrEqual(p.value);
    }
  });
});
