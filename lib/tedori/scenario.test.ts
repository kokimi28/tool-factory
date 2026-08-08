/**
 * E5 3シナリオ比較の妥当性テスト。比較に使う代表年収で計算が破綻せず、
 * 年収が上がるほど手取り率が下がる（累進）ことを固定する。
 */
import { describe, it, expect } from "vitest";
import { SCENARIO_INCOMES } from "@/components/tedori/ScenarioCompare";
import { calculateNetSalary } from "./calculations";

describe("E5 tedori 3シナリオ比較", () => {
  it("代表年収は3件以上・昇順・正の整数", () => {
    expect(SCENARIO_INCOMES.length).toBeGreaterThanOrEqual(3);
    for (let i = 0; i < SCENARIO_INCOMES.length; i++) {
      expect(Number.isInteger(SCENARIO_INCOMES[i])).toBe(true);
      expect(SCENARIO_INCOMES[i]).toBeGreaterThan(0);
      if (i > 0) expect(SCENARIO_INCOMES[i]).toBeGreaterThan(SCENARIO_INCOMES[i - 1]);
    }
  });

  it("各シナリオで 0 < 手取り ≤ 額面", () => {
    for (const income of SCENARIO_INCOMES) {
      const r = calculateNetSalary({ annualIncome: income, isOver40: false });
      expect(r.takeHome).toBeGreaterThan(0);
      expect(r.takeHome).toBeLessThanOrEqual(income);
    }
  });

  it("年収が上がると手取り率は下がる（累進）", () => {
    const rates = SCENARIO_INCOMES.map(
      (income) => calculateNetSalary({ annualIncome: income, isOver40: false }).takeHomeRate,
    );
    for (let i = 1; i < rates.length; i++) {
      expect(rates[i]).toBeLessThan(rates[i - 1]);
    }
  });
});
