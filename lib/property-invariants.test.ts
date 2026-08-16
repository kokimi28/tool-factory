/**
 * 計算エンジンのプロパティ（不変条件）テスト（F2・2巡目）。
 *
 * 個別の期待値ではなく「入力を広く振っても常に成り立つべき性質」を決定的なグリッドで検証する:
 *   - 非負性（手取り・税額・控除は 0 以上）
 *   - 上界（手取りは額面・元本を超えない）
 *   - 単調性（額面が増えれば手取りは減らない 等）
 * 乱数は使わず格子状に列挙するため CI で決定的（flaky にならない）。境界値テスト（QC6）が
 * 拾えない「途中の広い範囲での破れ」をこの層が捕える。
 */
import { describe, it, expect } from "vitest";
import { calculateNetSalary } from "./tedori/calculations";
import { calcAll } from "./taishokukin/calculations";
import { calcFurusatoLimit } from "./furusato/calculations";
import { calcHomeLoanDeduction } from "./jutaku-loan/calculations";
import { takeHomeWithWall } from "./nenshu-kabe/calculations";
import { cumulativePension } from "./nenkin-kuriage/calculations";

/** [from, to] を step 刻みで列挙。 */
function range(from: number, to: number, step: number): number[] {
  const out: number[] = [];
  for (let v = from; v <= to; v += step) out.push(v);
  return out;
}

describe("F2 tedori: 手取りの不変条件", () => {
  const incomes = range(1_000_000, 20_000_000, 500_000);

  it("0 ≤ 手取り ≤ 額面・各控除は非負", () => {
    for (const income of incomes) {
      for (const isOver40 of [false, true]) {
        const r = calculateNetSalary({ annualIncome: income, isOver40 });
        expect(r.takeHome).toBeGreaterThanOrEqual(0);
        expect(r.takeHome).toBeLessThanOrEqual(income);
        expect(r.socialInsurance).toBeGreaterThanOrEqual(0);
        expect(r.incomeTax).toBeGreaterThanOrEqual(0);
        expect(r.residentTax).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("額面が増えれば手取りは減らない（単調非減少）", () => {
    let prev = -1;
    for (const income of incomes) {
      const r = calculateNetSalary({ annualIncome: income, isOver40: false });
      expect(r.takeHome).toBeGreaterThanOrEqual(prev);
      prev = r.takeHome;
    }
  });

  it("40歳以上（介護保険あり）の手取りは40歳未満以下", () => {
    for (const income of incomes) {
      const under = calculateNetSalary({ annualIncome: income, isOver40: false });
      const over = calculateNetSalary({ annualIncome: income, isOver40: true });
      expect(over.takeHome).toBeLessThanOrEqual(under.takeHome);
    }
  });
});

describe("F2 taishokukin: 退職金の税・手取りの不変条件", () => {
  const amounts = range(0, 40_000_000, 2_000_000);
  const years = range(1, 40, 3);

  it("税額は非負・手取りは退職金額以下", () => {
    for (const retirementAmount of amounts) {
      for (const yearsOfService of years) {
        const r = calcAll({ retirementAmount, yearsOfService, isExecutive: false });
        expect(r.totalTax).toBeGreaterThanOrEqual(0);
        expect(r.incomeTax).toBeGreaterThanOrEqual(0);
        expect(r.residentTax).toBeGreaterThanOrEqual(0);
        expect(r.netAmount).toBeLessThanOrEqual(retirementAmount);
      }
    }
  });

  it("同一勤続で退職金が増えれば税額は減らない（単調非減少）", () => {
    for (const yearsOfService of years) {
      let prev = -1;
      for (const retirementAmount of amounts) {
        const r = calcAll({ retirementAmount, yearsOfService, isExecutive: false });
        expect(r.totalTax).toBeGreaterThanOrEqual(prev);
        prev = r.totalTax;
      }
    }
  });
});

describe("F2 furusato: 限度額の不変条件", () => {
  const taxables = range(0, 20_000_000, 500_000);

  it("限度額は非負・課税所得が増えれば減らない（単調非減少）", () => {
    let prev = -1;
    for (const taxable of taxables) {
      const r = calcFurusatoLimit(taxable);
      expect(r.limit).toBeGreaterThanOrEqual(0);
      expect(r.limit).toBeGreaterThanOrEqual(prev);
      prev = r.limit;
    }
  });
});

describe("F2 jutaku-loan: 控除の不変条件", () => {
  it("各年の控除額は非負", () => {
    for (const principal of range(10_000_000, 60_000_000, 10_000_000)) {
      for (const annualRatePercent of [0, 0.5, 1.0, 2.0]) {
        const r = calcHomeLoanDeduction({
          principal,
          annualRatePercent,
          years: 35,
          housingType: "long_term",
        });
        for (const y of r.schedule) {
          expect(y.deduction).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });
});

describe("F2 nenshu-kabe: 壁ありの手取りの不変条件", () => {
  const walls = [1_060_000, 1_300_000] as const;

  it("0 ≤ 手取り ≤ 年収", () => {
    for (const wall of walls) {
      for (const income of range(800_000, 2_000_000, 100_000)) {
        const r = takeHomeWithWall(income, wall, false);
        expect(r.takeHome).toBeGreaterThanOrEqual(0);
        expect(r.takeHome).toBeLessThanOrEqual(income);
      }
    }
  });
});

describe("F2 nenkin-kuriage: 累計受給額の不変条件", () => {
  it("累計は非負・受給到達年齢が上がれば減らない（単調非減少）", () => {
    for (const startAge of [60, 65, 70, 75]) {
      let prev = -1;
      for (const atAge of range(startAge, 100, 1)) {
        const cum = cumulativePension(150_000, startAge, atAge);
        expect(cum).toBeGreaterThanOrEqual(0);
        expect(cum).toBeGreaterThanOrEqual(prev);
        prev = cum;
      }
    }
  });
});
