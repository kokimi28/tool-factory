/**
 * 端数処理の横断監査（auto-backlog F10）。
 *
 * 税額の丸めは「切り捨てる」までは共通でも、**単位が場面ごとに違う**。
 * 単位を1つ間違えると全ツールの表示額が静かにずれるうえ、他ツールと見比べて
 * 「不統一だ」と“統一”すると悪化する。そこで根拠と単位をここに1か所へ集め、
 * 各ツールが実際にその単位で丸めていることを検査する。
 *
 * ─────────────────────────────────────────────────────────────
 *  根拠（最終確認日: 2026-08-18・e-Gov 法令 API の条文を実測）
 * ─────────────────────────────────────────────────────────────
 *  ■ 国税通則法 第118条第1項 … 国税の**課税標準** → 1,000円未満切捨
 *  ■ 国税通則法 第119条第1項 … 国税の**確定金額** → 100円未満切捨
 *  ■ 国税通則法施行令 第40条  … 上の特例（1円未満切捨）の対象＝源泉徴収の所得税。
 *      ただし**年末調整（所得税法190条）と、退職所得（199条・201条1項の適用があるもの）は除外**。
 *  ■ 復興財源確保法 第30条第1項第2号 … **年末調整の年税額**（所得税＋復興特別所得税の合計）
 *      → **100円未満切捨**
 *  ■ 復興財源確保法 第31条第2項 … **源泉徴収**に係る所得税＋復興特別所得税は、通則法119条に
 *      かかわらず**合計額で1円未満切捨**
 *  ■ 地方税法 第20条の4の2第1項 … 地方税の課税標準額 → 1,000円未満切捨
 *  ■ 地方税法 第20条の4の2第3項 … 地方税の確定金額 → 100円未満切捨
 *  ■ 地方税法 第20条の4の2第8項 … 市町村民税・道府県民税・森林環境税は**一の地方税とみなす**
 *      ＝合算してから100円未満を切り捨てる（別々に切り捨てるのではない）
 *
 *  したがって場面ごとの単位はこうなる:
 *
 *  | 場面                                   | 課税標準 | 税額（所得税＋復興） |
 *  |----------------------------------------|----------|----------------------|
 *  | 給与の年税額（年末調整／確定申告）     | 1,000円  | **100円**            |
 *  | 年金の年税額（確定申告）               | 1,000円  | **100円**            |
 *  | 退職金の源泉徴収                       | 1,000円  | **1円**              |
 *
 *  退職金だけ1円単位なのは復興財源確保法31条2項による。給与・年金と揃えてはいけない。
 */
import { describe, expect, it } from 'vitest';

import { calcIncomeTax as taishokukinIncomeTax } from './taishokukin/calculations';
import { calculateNetSalary } from './tedori/calculations';
import { pensionNet } from './nenkin-kuriage/net';
import { takeHomeAtIncome } from './nenshu-kabe/calculations';

/** 整数どうしの割り算（浮動小数点の誤差を持ち込まない）。 */
const intDiv = (a: number, b: number): number => (a - (a % b)) / b;

/** 退職所得の所得税額（復興前）。課税退職所得金額は1,000円の倍数なので常に整数になる。 */
function baseRetirementTax(taxable: number): number {
  const BR = [
    { upTo: 1_950_000, pct: 5, deduction: 0 },
    { upTo: 3_300_000, pct: 10, deduction: 97_500 },
    { upTo: 6_950_000, pct: 20, deduction: 427_500 },
    { upTo: 9_000_000, pct: 23, deduction: 636_000 },
    { upTo: 18_000_000, pct: 33, deduction: 1_536_000 },
    { upTo: 40_000_000, pct: 40, deduction: 2_796_000 },
    { upTo: Number.POSITIVE_INFINITY, pct: 45, deduction: 4_796_000 },
  ];
  const b = BR.find((x) => taxable <= x.upTo)!;
  return intDiv(taxable * b.pct, 100) - b.deduction;
}

const INCOMES = [
  1_000_000, 2_000_000, 3_000_000, 4_000_000, 5_000_000, 6_000_000, 7_000_000,
  8_000_000, 10_000_000, 12_000_000, 15_000_000, 20_000_000, 30_000_000,
];

describe('給与の年税額は100円単位（年末調整＝復興財源確保法30条1項2号）', () => {
  it('tedori: 所得税は100円の倍数', () => {
    for (const y of INCOMES) {
      for (const over of [false, true]) {
        const r = calculateNetSalary({ annualIncome: y, isOver40: over });
        expect(r.incomeTax % 100).toBe(0);
      }
    }
  });

  it('nenshu-kabe: 所得税は100円の倍数（tedori と同一仕様）', () => {
    for (const y of INCOMES) {
      expect(takeHomeAtIncome(y, true).incomeTax % 100).toBe(0);
      expect(takeHomeAtIncome(y, false).incomeTax % 100).toBe(0);
    }
  });

  it('課税所得は1,000円の倍数（通則法118条1項）', () => {
    for (const y of INCOMES) {
      expect(calculateNetSalary({ annualIncome: y, isOver40: false }).taxableIncomeForIncomeTax % 1000).toBe(0);
    }
  });

  it('住民税も100円単位で、均等割を足しても100円の倍数のまま', () => {
    for (const y of INCOMES) {
      expect(calculateNetSalary({ annualIncome: y, isOver40: false }).residentTax % 100).toBe(0);
    }
  });
});

describe('年金の年税額も100円単位（確定申告＝通則法119条1項）', () => {
  it('所得税・住民税とも100円の倍数', () => {
    for (const p of [1_400_000, 1_800_000, 2_556_000, 3_312_000, 5_000_000, 8_000_000]) {
      const r = pensionNet({ annualPension: p });
      expect(r.incomeTax % 100).toBe(0);
      expect(r.residentLevy % 100).toBe(0);
    }
  });
});

describe('退職金の源泉徴収だけは1円単位（復興財源確保法31条2項）', () => {
  it('100円の倍数に丸められていない（給与・年金と揃えてはいけない）', () => {
    // 課税退職所得金額100万円 → 所得税50,000円 → ×1.021 ＝ 51,050円。
    // 100円未満切捨にすると51,000円になってしまう。
    expect(taishokukinIncomeTax(1_000_000)).toBe(51_050);
    expect(taishokukinIncomeTax(1_000_000) % 100).not.toBe(0);
  });

  it('1円単位であることが偶然でないと示す（100円の倍数でない例が複数ある）', () => {
    const notRound = [1_000_000, 2_000_000, 4_000_000, 6_000_000, 8_000_000]
      .map(taishokukinIncomeTax)
      .filter((t) => t % 100 !== 0);
    expect(notRound.length).toBeGreaterThanOrEqual(3);
  });

  it('所得税と復興特別所得税を合算してから切り捨てても同じ額になる', () => {
    // 31条2項は「合計額で1円未満切捨」。課税退職所得金額が1,000円の倍数なので
    // 所得税額は必ず整数になり、別々に切り捨てても合計で切り捨てても一致する。
    // ＝現在の実装（別々に floor）は結果として条文どおり。
    for (let t = 1_000; t <= 20_000_000; t += 7_000) {
      const base = baseRetirementTax(t);
      if (base <= 0) continue;
      expect(Number.isInteger(base)).toBe(true); // 合算切捨と別々切捨が一致する前提
      // 合算してから切り捨てた額（整数演算で厳密に求める）
      const combined = base + intDiv(base * 21, 1_000);
      expect(taishokukinIncomeTax(t)).toBe(combined);
    }
  });

  it('「× 1.021」を浮動小数点でやると1円下振れする（実装が2段階で計算している理由）', () => {
    // base=1,000 のとき 1000 * 1.021 は 1020.9999999999999 になり、floor すると 1020。
    // 正しくは 1,021 円。実装が「所得税 ＋ floor(所得税 × 2.1%)」の2段階にしているのは
    // この誤差を避けるため。将来「1.021 を掛けるだけで済む」と単純化されるのを赤で止める。
    expect(Math.floor(1_000 * 1.021)).toBe(1_020); // 浮動小数点の実際の挙動
    expect(1_000 + intDiv(1_000 * 21, 1_000)).toBe(1_021); // 正しい額
    expect(taishokukinIncomeTax(20_000)).toBe(1_021); // 実装は正しい側

    // 下振れは例外ではなく広範囲で起きる
    let naiveWrong = 0;
    for (let t = 1_000; t <= 20_000_000; t += 1_000) {
      const base = baseRetirementTax(t);
      if (base <= 0) continue;
      if (Math.floor(base * 1.021) !== base + intDiv(base * 21, 1_000)) naiveWrong += 1;
    }
    expect(naiveWrong).toBeGreaterThan(100);
  });
});
