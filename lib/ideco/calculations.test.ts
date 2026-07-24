/**
 * iDeCo受取税シミュレーター - 計算ロジック単体テスト (S002)
 *
 * 期待値は権威ソースの実例（大和証券・マネーキャリア）および法令の基本式から導出。
 * 最終確認日: 2026-06-21
 */
import { describe, it, expect } from 'vitest';
import {
  calcEffectiveYears,
  calcRetirementDeduction,
  calcDeductionByFormula,
  calcDeemedYearsFromAmount,
  calcUsedOverlapYears,
  calcOverlapDeduction,
  calcTaxableIncome,
  calcIncomeTax,
  calcResidentTax,
  calcIdecoSim,
  compareVariants,
  type IdecoSimInput,
} from './calculations';

// ============================================================
// 端数処理・基礎関数
// ============================================================

describe('calcEffectiveYears（勤続年数の切り上げ／所令69）', () => {
  it('端数月なしはそのまま', () => {
    expect(calcEffectiveYears(20, 0)).toBe(20);
    expect(calcEffectiveYears(13)).toBe(13);
  });
  it('19年5ヶ月 → 20年に切り上げ', () => {
    expect(calcEffectiveYears(19, 5)).toBe(20);
  });
  it('1ヶ月でも切り上げ', () => {
    expect(calcEffectiveYears(10, 1)).toBe(11);
  });
});

describe('退職所得控除の基本式（所法30③）', () => {
  it('勤続20年 → 800万円', () => {
    expect(calcRetirementDeduction(20)).toBe(8_000_000);
  });
  it('勤続21年 → 870万円', () => {
    expect(calcRetirementDeduction(21)).toBe(8_700_000);
  });
  it('19年5ヶ月 → 切上20年 → 800万円', () => {
    expect(calcRetirementDeduction(calcEffectiveYears(19, 5))).toBe(8_000_000);
  });
  it('最低80万円保証（勤続1年）', () => {
    expect(calcRetirementDeduction(1)).toBe(800_000);
  });
  it('0年は0円', () => {
    expect(calcRetirementDeduction(0)).toBe(0);
  });
});

describe('calcDeductionByFormula（重複減算用の素の式＝最低保証なし）', () => {
  it('10年 → 400万円', () => {
    expect(calcDeductionByFormula(10)).toBe(4_000_000);
  });
  it('13年 → 520万円', () => {
    expect(calcDeductionByFormula(13)).toBe(5_200_000);
  });
  it('15年 → 600万円', () => {
    expect(calcDeductionByFormula(15)).toBe(6_000_000);
  });
  it('境界（厳密版）: 21年 → 800万 + 70万×1 = 870万円', () => {
    expect(calcDeductionByFormula(21)).toBe(8_700_000);
  });
  it('最低保証は掛けない（1年 → 40万円）', () => {
    expect(calcDeductionByFormula(1)).toBe(400_000);
  });
});

// ============================================================
// 課税退職所得・所得税・住民税
// ============================================================

describe('calcTaxableIncome（課税退職所得・1/2課税・1,000円未満切り捨て）', () => {
  it('標準: (350万 − 120万) × 1/2 = 115万円', () => {
    expect(calcTaxableIncome(3_500_000, 1_200_000)).toBe(1_150_000);
  });
  it('1,000円未満切り捨て: (3,000,500 − 0)/2 = 1,500,250 → 1,500,000', () => {
    expect(calcTaxableIncome(3_000_500, 0)).toBe(1_500_000);
  });
  it('控除超過は0', () => {
    expect(calcTaxableIncome(3_000_000, 5_000_000)).toBe(0);
  });
});

describe('calcIncomeTax（所得税・復興特別所得税込み・1円未満切り捨て）', () => {
  it('課税195万 → 97,500 + floor(97,500×2.1%) = 99,547円', () => {
    // floor(1,950,000×0.05 − 0) = 97,500、floor(97,500×0.021)=2,047
    expect(calcIncomeTax(1_950_000)).toBe(99_547);
  });
  it('各税率区分の上限（10%〜45%・復興特別所得税込み）', () => {
    // 速算表（課税×率 − 控除）＋ 復興特別所得税 2.1% を実出力で固定
    expect(calcIncomeTax(3_300_000)).toBe(237_382); // 10%区分上限
    expect(calcIncomeTax(6_950_000)).toBe(982_712); // 20%区分上限
    expect(calcIncomeTax(9_000_000)).toBe(1_464_114); // 23%区分上限
    expect(calcIncomeTax(18_000_000)).toBe(4_496_484); // 33%区分上限
    expect(calcIncomeTax(40_000_000)).toBe(13_481_284); // 40%区分上限
    expect(calcIncomeTax(50_000_000)).toBe(18_075_784); // 45%区分（Infinity）
  });
  it('課税0は税額0', () => {
    expect(calcIncomeTax(0)).toBe(0);
  });
});

describe('calcResidentTax（住民税一律10%）', () => {
  it('課税150万 → 15万円', () => {
    expect(calcResidentTax(1_500_000)).toBe(150_000);
  });
  it('100円未満切り捨て（1,000円単位でない入力の丸め契約）', () => {
    // 1,234,500 × 10% = 123,450 → 100円未満切り捨てで 123,400
    expect(calcResidentTax(1_234_500)).toBe(123_400);
  });
  it('課税0は税額0', () => {
    expect(calcResidentTax(0)).toBe(0);
  });
});

// ============================================================
// みなし勤続年数の逆算（所令70 / No.2732）
// ============================================================

describe('calcDeemedYearsFromAmount（みなし勤続年数の逆算）', () => {
  it('350万円 → floor(350万/40万) = 8年', () => {
    expect(calcDeemedYearsFromAmount(3_500_000)).toBe(8);
  });
  it('800万円ちょうど → 20年', () => {
    expect(calcDeemedYearsFromAmount(8_000_000)).toBe(20);
  });
  it('900万円 → floor((900万−800万)/70万)+20 = 21年', () => {
    expect(calcDeemedYearsFromAmount(9_000_000)).toBe(21);
  });
  it('100万円 → floor(100万/40万) = 2年', () => {
    expect(calcDeemedYearsFromAmount(1_000_000)).toBe(2);
  });
});

describe('calcUsedOverlapYears（使い切り/使い残しの重複年数確定）', () => {
  it('使い切り → 重複年数（切り捨て）をそのまま使用', () => {
    // 前収入2000万 ≥ base(30)=1500万 → 使い切り
    expect(calcUsedOverlapYears(20_000_000, 30, 15, 10)).toBe(10);
  });
  it('使い残し → みなし勤続年数を上限とする', () => {
    // 前収入100万 < base(10)=400万 → 使い残し、みなし=2年で上限
    expect(calcUsedOverlapYears(1_000_000, 10, 15, 10)).toBe(2);
  });
  it('重複は前後どちらの期間も超えない（クランプ）', () => {
    expect(calcUsedOverlapYears(20_000_000, 30, 8, 20)).toBe(8);
  });
});

describe('calcOverlapDeduction（base(後) − base(重複)＝厳密版）', () => {
  it('後13年・重複10年 → 520万 − 400万 = 120万円', () => {
    expect(calcOverlapDeduction(13, 10)).toEqual({
      deduction: 1_200_000,
      reduction: 4_000_000,
    });
  });
  it('境界: 後30年・重複21年 → 1500万 − 870万 = 630万円', () => {
    expect(calcOverlapDeduction(30, 21)).toEqual({
      deduction: 6_300_000,
      reduction: 8_700_000,
    });
  });
});

// ============================================================
// 統合: 19年ルール（退職金 先 → iDeCo 後）
// ============================================================

describe('19年ルール（退職金 先 → iDeCo 後）', () => {
  it('大和証券例: iDeCo加入13年・350万・重複10年・退職金は控除使い切り → iDeCo控除120万・課税115万', () => {
    const input: IdecoSimInput = {
      taishokukin: { amount: 30_000_000, years: 20 }, // 控除800万を使い切る額
      ideco: { amount: 3_500_000, years: 13 },
      order: 'taishoku_first',
      gapYears: 5,
      overlapYears: 10,
      laterReceiptYear: 2030,
    };
    const result = calcIdecoSim(input);
    const ideco = result.receipts[1]; // [先=退職金, 後=iDeCo]
    expect(ideco.label).toBe('iDeCo一時金');
    expect(ideco.deduction).toBe(1_200_000);
    expect(ideco.taxableIncome).toBe(1_150_000);
    expect(result.appliedRule).toBe('19年ルール');
    expect(result.adjustmentApplied).toBe(true);
  });

  it('マネーキャリア例: 退職金2000万/30年 + iDeCo500万/15年/5年後/重複10年 → iDeCo控除200万・課税150万', () => {
    const input: IdecoSimInput = {
      taishokukin: { amount: 20_000_000, years: 30 },
      ideco: { amount: 5_000_000, years: 15 },
      order: 'taishoku_first',
      gapYears: 5,
      overlapYears: 10,
      laterReceiptYear: 2031,
    };
    const result = calcIdecoSim(input);
    const taishoku = result.receipts[0];
    const ideco = result.receipts[1];
    // 退職金（先）: 控除1500万・課税250万
    expect(taishoku.label).toBe('退職金');
    expect(taishoku.deduction).toBe(15_000_000);
    expect(taishoku.taxableIncome).toBe(2_500_000);
    // iDeCo（後）: 控除200万・課税150万
    expect(ideco.deduction).toBe(2_000_000);
    expect(ideco.taxableIncome).toBe(1_500_000);
    expect(result.appliedRule).toBe('19年ルール');
  });

  it('使い残し（みなし）: 前の退職金が控除を使い残すと重複がみなし年数で上限される', () => {
    const input: IdecoSimInput = {
      taishokukin: { amount: 1_000_000, years: 10 }, // base(10)=400万 を使い残す
      ideco: { amount: 5_000_000, years: 15 },
      order: 'taishoku_first',
      gapYears: 5,
      overlapYears: 10,
      laterReceiptYear: 2030,
    };
    const result = calcIdecoSim(input);
    // みなし=floor(100万/40万)=2年 → iDeCo控除 = base(15) − base(2) = 600万 − 80万 = 520万
    expect(result.receipts[1].deduction).toBe(5_200_000);
    expect(result.notes.some((n) => n.includes('みなし勤続年数'))).toBe(true);
  });
});

// ============================================================
// 統合: 10年ルール（iDeCo 先 → 退職金 後）
// ============================================================

describe('10年ルール（iDeCo 先 → 退職金 後・2026改正）', () => {
  it('iDeCo先 → 3年後に退職金2000万/30年・重複15年・laterReceiptYear=2026 → 退職金控除900万・課税550万', () => {
    const input: IdecoSimInput = {
      taishokukin: { amount: 20_000_000, years: 30 },
      ideco: { amount: 10_000_000, years: 15 }, // base(15)=600万を使い切る
      order: 'ideco_first',
      gapYears: 3,
      overlapYears: 15,
      laterReceiptYear: 2026,
    };
    const result = calcIdecoSim(input);
    const ideco = result.receipts[0]; // [先=iDeCo, 後=退職金]
    const taishoku = result.receipts[1];
    expect(ideco.label).toBe('iDeCo一時金');
    expect(ideco.deduction).toBe(6_000_000); // 先は単独計算
    // 退職金（後）: 控除 = base(30)−base(15) = 1500万−600万 = 900万、課税550万
    expect(taishoku.label).toBe('退職金');
    expect(taishoku.deduction).toBe(9_000_000);
    expect(taishoku.taxableIncome).toBe(5_500_000);
    expect(result.appliedRule).toBe('10年ルール');
    expect(result.adjustmentApplied).toBe(true);
  });

  it('境界: gap=9 は調整あり / gap=10 は調整なし（10年ルール=前年以前9年内）', () => {
    const baseInput: IdecoSimInput = {
      taishokukin: { amount: 20_000_000, years: 30 },
      ideco: { amount: 10_000_000, years: 15 },
      order: 'ideco_first',
      gapYears: 9,
      overlapYears: 15,
      laterReceiptYear: 2026,
    };
    expect(calcIdecoSim({ ...baseInput, gapYears: 9 }).adjustmentApplied).toBe(true);
    expect(calcIdecoSim({ ...baseInput, gapYears: 10 }).adjustmentApplied).toBe(false);
  });

  it('改正前: laterReceiptYear=2025 は旧5年ルール（前年以前4年内）', () => {
    const baseInput: IdecoSimInput = {
      taishokukin: { amount: 20_000_000, years: 30 },
      ideco: { amount: 10_000_000, years: 15 },
      order: 'ideco_first',
      gapYears: 5,
      overlapYears: 15,
      laterReceiptYear: 2025,
    };
    // 旧4年内: gap=5 は調整なし、gap=4 は調整あり
    expect(calcIdecoSim({ ...baseInput, gapYears: 5 }).adjustmentApplied).toBe(false);
    const adjusted = calcIdecoSim({ ...baseInput, gapYears: 4 });
    expect(adjusted.adjustmentApplied).toBe(true);
    expect(adjusted.notes.some((n) => n.includes('旧制度'))).toBe(true);
  });
});

// ============================================================
// 統合: 間隔でルール回避（調整なし・満額×2）
// ============================================================

describe('間隔でルール回避 → 調整なし・満額×2', () => {
  it('退職金先・間隔25年（>19）→ iDeCoは満額控除', () => {
    const input: IdecoSimInput = {
      taishokukin: { amount: 20_000_000, years: 30 },
      ideco: { amount: 5_000_000, years: 15 },
      order: 'taishoku_first',
      gapYears: 25,
      overlapYears: 10,
      laterReceiptYear: 2051,
    };
    const result = calcIdecoSim(input);
    expect(result.appliedRule).toBe('調整なし');
    expect(result.adjustmentApplied).toBe(false);
    // iDeCo は満額 base(15)=600万、課税は (500万−600万)→0
    expect(result.receipts[1].deduction).toBe(6_000_000);
    expect(result.receipts[1].overlapReduction).toBe(0);
    expect(result.receipts[1].taxableIncome).toBe(0);
  });

  it('退職金先・境界: gap=19 は調整あり / gap=20 は調整なし', () => {
    const baseInput: IdecoSimInput = {
      taishokukin: { amount: 20_000_000, years: 30 },
      ideco: { amount: 5_000_000, years: 15 },
      order: 'taishoku_first',
      gapYears: 19,
      overlapYears: 10,
      laterReceiptYear: 2045,
    };
    expect(calcIdecoSim({ ...baseInput, gapYears: 19 }).adjustmentApplied).toBe(true);
    expect(calcIdecoSim({ ...baseInput, gapYears: 20 }).adjustmentApplied).toBe(false);
  });

  it('iDeCo先・間隔15年（>9）→ 退職金は満額控除', () => {
    const input: IdecoSimInput = {
      taishokukin: { amount: 20_000_000, years: 30 },
      ideco: { amount: 10_000_000, years: 15 },
      order: 'ideco_first',
      gapYears: 15,
      overlapYears: 15,
      laterReceiptYear: 2041,
    };
    const result = calcIdecoSim(input);
    expect(result.appliedRule).toBe('調整なし');
    expect(result.receipts[1].deduction).toBe(15_000_000); // base(30)満額
  });
});

// ============================================================
// 統合: 同年合算（所令69③ / No.2735）
// ============================================================

describe('同年合算（同一年に両方受給）', () => {
  it('退職金600万/38年 + iDeCo3000万/10年・重複5年 → 通算43年・控除2410万', () => {
    const input: IdecoSimInput = {
      taishokukin: { amount: 6_000_000, years: 38 },
      ideco: { amount: 30_000_000, years: 10 },
      order: 'same_year',
      gapYears: 0,
      overlapYears: 5,
    };
    const result = calcIdecoSim(input);
    expect(result.receipts).toHaveLength(1);
    const g = result.receipts[0];
    expect(g.label).toBe('合算');
    expect(g.income).toBe(36_000_000);
    // 通算 = 38 + 10 − 5 = 43年 → base(43) = 800万 + 70万×23 = 2410万
    expect(g.deduction).toBe(24_100_000);
    // 課税 = (3600万 − 2410万)/2 = 595万
    expect(g.taxableIncome).toBe(5_950_000);
    // 重複無視の満額 base(48)=2760万 との差が overlapReduction
    expect(g.baseDeduction).toBe(27_600_000);
    expect(g.overlapReduction).toBe(3_500_000);
    expect(result.appliedRule).toBe('同年合算');
    expect(result.adjustmentApplied).toBe(true);
  });

  it('合計値が内訳と整合する', () => {
    const input: IdecoSimInput = {
      taishokukin: { amount: 6_000_000, years: 38 },
      ideco: { amount: 30_000_000, years: 10 },
      order: 'same_year',
      gapYears: 0,
      overlapYears: 5,
    };
    const result = calcIdecoSim(input);
    const g = result.receipts[0];
    expect(result.totalIncome).toBe(g.income);
    expect(result.totalTax).toBe(g.incomeTax + g.residentTax);
    expect(result.totalNet).toBe(g.netAmount);
    expect(result.totalNet).toBe(g.income - result.totalTax);
  });
});

// ============================================================
// 隣接2比較
// ============================================================

describe('compareVariants（隣接2比較）', () => {
  const input: IdecoSimInput = {
    taishokukin: { amount: 20_000_000, years: 30 },
    ideco: { amount: 5_000_000, years: 15 },
    order: 'taishoku_first',
    gapYears: 5,
    overlapYears: 10,
    laterReceiptYear: 2031,
  };

  it('base / reversedOrder / enoughGap を返す', () => {
    const cmp = compareVariants(input);
    expect(cmp.base.appliedRule).toBe('19年ルール');
    expect(cmp.reversedOrder).toBeDefined();
    expect(cmp.enoughGap).toBeDefined();
  });

  it('enoughGap は重複調整なし（満額×2）', () => {
    const cmp = compareVariants(input);
    expect(cmp.enoughGap.adjustmentApplied).toBe(false);
    expect(cmp.enoughGap.appliedRule).toBe('調整なし');
  });

  it('reversedOrder は順序が反転している（iDeCo先）', () => {
    const cmp = compareVariants(input);
    // 反転後は [先=iDeCo, 後=退職金]
    expect(cmp.reversedOrder.receipts[0].label).toBe('iDeCo一時金');
    expect(cmp.reversedOrder.receipts[1].label).toBe('退職金');
  });
});


describe('記事 worked example: iDeCo一時金の受取税 基本（柱記事 ideco-lump-sum-tax の裏取り）', () => {
  it('加入20年・控除800万円（最低保証込み）', () => {
    expect(calcRetirementDeduction(20)).toBe(8_000_000);
  });
  it('iDeCo一時金500万円・加入20年は控除内で非課税（課税0・税0）', () => {
    const ded = calcRetirementDeduction(20);
    const taxable = calcTaxableIncome(5_000_000, ded);
    expect(taxable).toBe(0);
    expect(calcIncomeTax(taxable)).toBe(0);
    expect(calcResidentTax(taxable)).toBe(0);
  });
  it('iDeCo一時金1,500万円・加入20年: 課税350万・所得税278,222・住民税350,000', () => {
    const ded = calcRetirementDeduction(20);
    const taxable = calcTaxableIncome(15_000_000, ded);
    expect(taxable).toBe(3_500_000);
    expect(calcIncomeTax(taxable)).toBe(278_222);
    expect(calcResidentTax(taxable)).toBe(350_000);
  });
});


describe('記事 worked example: 受取順序・間隔で変わる（receipt-order-comparison 記事の裏取り）', () => {
  // 退職金2,000万/勤続30年・iDeCo1,000万/加入15年・重複15年・後の受給2026年
  const base: IdecoSimInput = {
    taishokukin: { amount: 20_000_000, years: 30 },
    ideco: { amount: 10_000_000, years: 15 },
    order: 'ideco_first', gapYears: 3, overlapYears: 15, laterReceiptYear: 2026,
  };
  it('同年合算: 税1,861,869 / 手取り28,138,131', () => {
    const r = calcIdecoSim({ ...base, order: 'same_year', gapYears: 0 });
    expect(r.appliedRule).toBe('同年合算');
    expect(r.totalTax).toBe(1_861_869);
    expect(r.totalNet).toBe(28_138_131);
  });
  it('iDeCo先→3年後に退職金（10年ルール適用）: 税1,541,274 / 手取り28,458,726', () => {
    const r = calcIdecoSim(base);
    expect(r.appliedRule).toBe('10年ルール');
    expect(r.totalTax).toBe(1_541_274);
    expect(r.totalNet).toBe(28_458_726);
  });
  it('iDeCo先→10年空ける（調整なし）: 税710,354 / 手取り29,289,646', () => {
    const r = calcIdecoSim({ ...base, gapYears: 10 });
    expect(r.appliedRule).toBe('調整なし');
    expect(r.totalTax).toBe(710_354);
    expect(r.totalNet).toBe(29_289_646);
  });
});


describe('記事 worked example: iDeCo一時金vs年金（ideco-lump-sum-vs-pension 記事の一時金側の裏取り）', () => {
  it('iDeCo一時金800万・加入15年: 控除600万・課税100万・所得税51,050・住民税100,000', () => {
    const ded = calcRetirementDeduction(15);
    expect(ded).toBe(6_000_000);
    const taxable = calcTaxableIncome(8_000_000, ded);
    expect(taxable).toBe(1_000_000);
    expect(calcIncomeTax(taxable)).toBe(51_050);
    expect(calcResidentTax(taxable)).toBe(100_000);
  });
});


describe('記事 worked example: 重複調整の仕組み・使い残しとみなし年数（overlap-deduction-explained の裏取り）', () => {
  // iDeCo先400万/加入15年（控除600万を使い残し）→ 3年後に退職金2,000万/勤続30年・重複15年入力・2026年
  const base: IdecoSimInput = {
    taishokukin: { amount: 20_000_000, years: 30 },
    ideco: { amount: 4_000_000, years: 15 },
    order: 'ideco_first', gapYears: 3, overlapYears: 15, laterReceiptYear: 2026,
  };
  it('みなし勤続年数: 使い残し400万 → floor(400万/40万)=10年', () => {
    expect(calcDeemedYearsFromAmount(4_000_000)).toBe(10);
    expect(calcRetirementDeduction(15)).toBe(6_000_000); // iDeCo単独控除600万＞400万＝使い残し
  });
  it('使用重複年数はみなし10年で上限（入力15年→10年）', () => {
    expect(calcUsedOverlapYears(4_000_000, 15, 30, 15)).toBe(10);
  });
  it('後の退職金の控除減額: base(30)1,500万 − base(10)400万 = 1,100万', () => {
    const od = calcOverlapDeduction(30, 10);
    expect(od.deduction).toBe(11_000_000);
    expect(od.reduction).toBe(4_000_000);
  });
  it('総額: 10年ルールで税932,422 / 手取り23,067,578', () => {
    const r = calcIdecoSim(base);
    expect(r.appliedRule).toBe('10年ルール');
    expect(r.totalTax).toBe(932_422);
    expect(r.totalNet).toBe(23_067_578);
  });
  it('対比: 11年空けて重複調整回避 → 税405,702 / 手取り23,594,298', () => {
    const r = calcIdecoSim({ ...base, gapYears: 11 });
    expect(r.appliedRule).toBe('調整なし');
    expect(r.totalTax).toBe(405_702);
    expect(r.totalNet).toBe(23_594_298);
  });
});


describe('記事 worked example: 加入年数と退職所得控除（ideco-receiving-age 記事の裏取り）', () => {
  it('一時金1,000万・加入25年: 控除1,150万＞1,000万 → 課税0・税0', () => {
    const ded = calcRetirementDeduction(25);
    expect(ded).toBe(11_500_000);
    const taxable = calcTaxableIncome(10_000_000, ded);
    expect(taxable).toBe(0);
    expect(calcIncomeTax(taxable)).toBe(0);
    expect(calcResidentTax(taxable)).toBe(0);
  });
  it('一時金1,000万・加入15年: 控除600万 → 課税200万・所得税104,652・住民税200,000', () => {
    const ded = calcRetirementDeduction(15);
    expect(ded).toBe(6_000_000);
    const taxable = calcTaxableIncome(10_000_000, ded);
    expect(taxable).toBe(2_000_000);
    expect(calcIncomeTax(taxable)).toBe(104_652);
    expect(calcResidentTax(taxable)).toBe(200_000);
  });
});
