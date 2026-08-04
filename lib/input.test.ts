/**
 * 数値入力パースのエッジケーステスト（QC12）。
 * 各 Calculator が共有する入力サニタイズの不変条件を固定する。
 */
import { describe, it, expect } from "vitest";
import { parseNonNegativeNumber, clamp } from "./input";

describe("QC12 parseNonNegativeNumber", () => {
  it("通常の半角数値はそのまま", () => {
    expect(parseNonNegativeNumber("4000000")).toBe(4000000);
    expect(parseNonNegativeNumber("0.7")).toBe(0.7);
  });

  it("桁区切り（半角/全角カンマ）・空白を除去する", () => {
    expect(parseNonNegativeNumber("4,000,000")).toBe(4000000);
    expect(parseNonNegativeNumber("4，000，000")).toBe(4000000);
    expect(parseNonNegativeNumber(" 1 500 ")).toBe(1500);
  });

  it("全角数字を半角として解釈する", () => {
    expect(parseNonNegativeNumber("１２３")).toBe(123);
    expect(parseNonNegativeNumber("１，２３４")).toBe(1234);
    expect(parseNonNegativeNumber("０．５")).toBe(0.5);
  });

  it("空文字・非数値は 0", () => {
    expect(parseNonNegativeNumber("")).toBe(0);
    expect(parseNonNegativeNumber("abc")).toBe(0);
    expect(parseNonNegativeNumber("12万")).toBe(0);
  });

  it("負値は 0 にクランプ", () => {
    expect(parseNonNegativeNumber("-5")).toBe(0);
    expect(parseNonNegativeNumber("-100000")).toBe(0);
  });

  it("Infinity 表現は 0", () => {
    expect(parseNonNegativeNumber("Infinity")).toBe(0);
  });
});

describe("QC12 clamp", () => {
  it("範囲内はそのまま", () => {
    expect(clamp(50, 0, 100)).toBe(50);
  });
  it("下限・上限で丸める", () => {
    expect(clamp(-5, 0, 100)).toBe(0);
    expect(clamp(150, 0, 100)).toBe(100);
  });
  it("NaN は下限", () => {
    expect(clamp(Number.NaN, 1, 10)).toBe(1);
  });
});
