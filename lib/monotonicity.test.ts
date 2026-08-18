/**
 * 単調性と段差の横断監査（auto-backlog F1）。
 *
 * 各ツールの主要な出力を1,000円刻みで走査し、「入力が増えたのに出力が減る点」を
 * 全部集める。目的は2つ:
 *
 *  ① **段差が無いはずのツールに段差が無いこと**（ふるさと納税の限度額・退職金の税額）
 *  ② **段差があるツールでは、段差が『制度上そこにあるはずの点』にだけあること**
 *
 * ②が重要な理由。手取りの逆転は「バグ」に見えるが、実際には制度側の段差である
 * ことが多い（住民税の均等割は課税・非課税の境目で5,000円が一度に乗る／令和7年度
 * 改正の基礎控除の上乗せは合計所得 132万・336万・489万・655万で段階的に下がる）。
 * 段差を「なめらかにする」修正はバグの作り込みになるため、**現在ある段差の集合を
 * そのまま固定**し、増えても減っても落ちるようにする。
 *
 * 走査で見つかった段差はすべて原因を特定済み（下の EXPECTED_* のコメント参照）。
 * 新しい段差が生まれたらこのテストが落ちるので、そこで原因を確かめる。
 */
import { describe, expect, it } from 'vitest';

import { calcFurusatoLimit } from './furusato/calculations';
import { pensionNet } from './nenkin-kuriage/net';
import { takeHomeAtIncome } from './nenshu-kabe/calculations';
import {
  calcIncomeTax as retirementIncomeTax,
  calcResidentTax as retirementResidentTax,
} from './taishokukin/calculations';
import { calculateNetSalary } from './tedori/calculations';

/** step 刻みで走査し、出力が前より小さくなった入力値を返す。 */
function descendingPoints(
  from: number,
  to: number,
  step: number,
  f: (x: number) => number,
): number[] {
  const points: number[] = [];
  let prev = f(from);
  for (let x = from + step; x <= to; x += step) {
    const v = f(x);
    if (v < prev) points.push(x);
    prev = v;
  }
  return points;
}

describe('段差が無いはずのもの', () => {
  it('ふるさと納税の控除上限額は課税所得に対して単調非減少', () => {
    expect(
      descendingPoints(0, 20_000_000, 1_000, (t) => calcFurusatoLimit(t).limit),
    ).toEqual([]);
  });

  it('退職金の税額は課税退職所得に対して単調非減少', () => {
    expect(
      descendingPoints(0, 50_000_000, 1_000, (t) =>
        retirementIncomeTax(t) + retirementResidentTax(t),
      ),
    ).toEqual([]);
  });
});

/**
 * 給与の手取りが下がる点（円）。すべて制度側の段差で、原因は次のとおり:
 *  1,268,000 … 住民税が課税に切り替わり均等割5,000円が一度に乗る
 *  2,001,000 … 給与所得が132万円を超え、基礎控除の上乗せが95万→88万に下がる
 *  4,751,000 … 給与所得が336万円を超え 88万→68万。同時に所得税が5%区分から10%区分へ
 *  6,656,000 … 給与所得が489万円を超え 68万→63万
 *  8,501,000 … 給与所得が655万円を超え 63万→58万
 */
const EXPECTED_SALARY_CLIFFS = [1_268_000, 2_001_000, 4_751_000, 6_656_000, 8_501_000];

describe('給与の手取りの段差は、制度上の点にだけある', () => {
  it('tedori: 段差の集合が想定どおり', () => {
    const found = descendingPoints(1_000_000, 20_000_000, 1_000, (inc) =>
      calculateNetSalary({ annualIncome: inc, isOver40: false }).takeHome,
    );
    expect(found).toEqual(EXPECTED_SALARY_CLIFFS);
  });

  it('nenshu-kabe（社会保険加入）も同じ段差を持つ（tedori と同一仕様なので当然そうなる）', () => {
    const found = descendingPoints(0, 5_000_000, 1_000, (inc) => takeHomeAtIncome(inc, true).takeHome);
    expect(found).toEqual(EXPECTED_SALARY_CLIFFS.filter((p) => p <= 5_000_000));
  });

  it('段差はいずれも1回きりで、直後は増加に戻る（谷ではなく段）', () => {
    for (const p of EXPECTED_SALARY_CLIFFS) {
      const at = calculateNetSalary({ annualIncome: p, isOver40: false }).takeHome;
      const next = calculateNetSalary({ annualIncome: p + 1_000, isOver40: false }).takeHome;
      expect(next).toBeGreaterThan(at);
    }
  });

  it('均等割の段差は、住民税が0から課税に変わる点にある', () => {
    const before = calculateNetSalary({ annualIncome: 1_267_000, isOver40: false });
    const after = calculateNetSalary({ annualIncome: 1_268_000, isOver40: false });
    expect(before.residentTax).toBe(0);
    expect(after.residentTax).toBeGreaterThan(0);
  });

  it('基礎控除の段差は合計所得 132万・336万・489万・655万にある（令和7年度改正の上乗せ）', () => {
    // 段差の前後で給与所得がその境目をまたいでいることを確認する
    const boundaries = [1_320_000, 3_360_000, 4_890_000, 6_550_000];
    const crossed = EXPECTED_SALARY_CLIFFS.slice(1).map((p) => {
      const a = calculateNetSalary({ annualIncome: p - 1_000, isOver40: false }).employmentIncome;
      const b = calculateNetSalary({ annualIncome: p, isOver40: false }).employmentIncome;
      return boundaries.find((x) => a <= x && b > x);
    });
    expect(crossed).toEqual(boundaries);
  });
});

/**
 * 年金の手取りが下がる点（円）。原因は給与と同じ構造:
 *  1,551,000 … 雑所得が住民税の非課税限度額45万円を超え、均等割5,000円が乗る
 *  2,421,000 / 4,759,000 / 6,559,000 / 8,427,000 … 基礎控除の上乗せの段差
 */
const EXPECTED_PENSION_CLIFFS = [1_551_000, 2_421_000, 4_759_000, 6_559_000, 8_427_000];

describe('年金の手取りの段差も、制度上の点にだけある', () => {
  it('段差の集合が想定どおり', () => {
    const found = descendingPoints(0, 10_000_000, 1_000, (p) => pensionNet({ annualPension: p }).net);
    expect(found).toEqual(EXPECTED_PENSION_CLIFFS);
  });

  it('最初の段差は住民税の非課税限度額（雑所得45万円）を超える点', () => {
    const before = pensionNet({ annualPension: 1_550_000 });
    const after = pensionNet({ annualPension: 1_551_000 });
    expect(before.miscIncome).toBe(450_000);
    expect(before.residentPerCapita).toBe(0);
    expect(after.residentPerCapita).toBeGreaterThan(0);
  });

  it('段差はいずれも1回きりで、直後は増加に戻る', () => {
    for (const p of EXPECTED_PENSION_CLIFFS) {
      expect(pensionNet({ annualPension: p + 1_000 }).net).toBeGreaterThan(
        pensionNet({ annualPension: p }).net,
      );
    }
  });
});
