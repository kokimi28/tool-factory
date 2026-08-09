/**
 * 年金ツールの URL 共有ヘルパーのテスト（E3）。
 * 共有された受給開始年齢の範囲丸め・フォールバックを固定する。
 */
import { describe, it, expect } from "vitest";
import { clampStartAge } from "./share";

describe("E3 nenkin-kuriage 共有年齢の丸め", () => {
  it("範囲内はそのまま（整数化）", () => {
    expect(clampStartAge(60)).toBe(60);
    expect(clampStartAge(70)).toBe(70);
    expect(clampStartAge(75)).toBe(75);
    expect(clampStartAge(66.4)).toBe(66);
  });

  it("範囲外は 60〜75 にクランプ", () => {
    expect(clampStartAge(50)).toBe(60);
    expect(clampStartAge(80)).toBe(75);
  });

  it("不正値（NaN/Infinity）は 65 にフォールバック", () => {
    expect(clampStartAge(NaN)).toBe(65);
    expect(clampStartAge(Infinity)).toBe(65);
  });
});
