/**
 * E9 入力バリデーションのテスト。空・不正・負・上限超過・全角の各エッジケースで
 * 正規化値とエラーメッセージが期待どおりになることを固定する。
 */
import { describe, it, expect } from "vitest";
import { validateNumberInput } from "./validate-input";

describe("E9 validateNumberInput", () => {
  it("空文字は未入力扱い（エラーなし・value=min）", () => {
    expect(validateNumberInput("")).toEqual({ value: 0, error: null });
    expect(validateNumberInput("   ")).toEqual({ value: 0, error: null });
  });

  it("正常な数値はそのまま（全角・桁区切りも許容）", () => {
    expect(validateNumberInput("5000000")).toEqual({ value: 5_000_000, error: null });
    expect(validateNumberInput("1,234,567")).toEqual({ value: 1_234_567, error: null });
    expect(validateNumberInput("４０００")).toEqual({ value: 4_000, error: null });
  });

  it("数字にならない入力はエラー（value=min）", () => {
    const r = validateNumberInput("abc");
    expect(r.value).toBe(0);
    expect(r.error).toBe("数字で入力してください。");
  });

  it("最小値未満はエラーで min にクランプ", () => {
    const r = validateNumberInput("-5");
    expect(r.value).toBe(0);
    expect(r.error).toContain("以上で入力してください");
  });

  it("最大値超過はエラーで max にクランプ", () => {
    const r = validateNumberInput("999999999", { max: 100_000_000 });
    expect(r.value).toBe(100_000_000);
    expect(r.error).toContain("以内で入力してください");
  });

  it("min/max の範囲内はエラーなし", () => {
    expect(validateNumberInput("60", { min: 60, max: 75 })).toEqual({ value: 60, error: null });
    expect(validateNumberInput("75", { min: 60, max: 75 })).toEqual({ value: 75, error: null });
  });
});
