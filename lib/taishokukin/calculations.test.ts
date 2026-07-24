/**
 * 計算ロジックの単体テスト
 *
 * テストケースは CLAUDE.md「単体テスト必須ケース」に基づく。
 * 想定値は国税庁の計算例または手計算で検算済み。
 */
import { describe, it, expect } from 'vitest';
import {
  calcEffectiveYears,
  calcRetirementDeduction,
  calcTaxableRetirementIncome,
  calcIncomeTax,
  calcResidentTax,
  calcAll,
  compareWithOneMoreYear,
  validateInput,
  calcWithholdingWithoutDeclaration,
} from './calculations';

describe('calcEffectiveYears: 勤続年数の切り上げ', () => {
  it('19年5ヶ月は20年に切り上げ', () => {
    expect(calcEffectiveYears(19, 5)).toBe(20);
  });
  it('20年0ヶ月は20年のまま', () => {
    expect(calcEffectiveYears(20, 0)).toBe(20);
  });
  it('20年1ヶ月は21年に切り上げ', () => {
    expect(calcEffectiveYears(20, 1)).toBe(21);
  });
  it('0年0ヶ月は0年', () => {
    expect(calcEffectiveYears(0, 0)).toBe(0);
  });
});

describe('calcRetirementDeduction: 退職所得控除額', () => {
  it('勤続1年は80万円（最低保証）', () => {
    expect(calcRetirementDeduction(1)).toBe(800_000);
  });
  it('勤続2年は80万円（40万×2=80万、最低保証と同額）', () => {
    expect(calcRetirementDeduction(2)).toBe(800_000);
  });
  it('勤続3年は120万円（40万×3）', () => {
    expect(calcRetirementDeduction(3)).toBe(1_200_000);
  });
  it('勤続20年は800万円（境界）', () => {
    expect(calcRetirementDeduction(20)).toBe(8_000_000);
  });
  it('勤続21年は870万円（境界後）', () => {
    expect(calcRetirementDeduction(21)).toBe(8_700_000);
  });
  it('勤続40年は2200万円（800万+70万×20）', () => {
    expect(calcRetirementDeduction(40)).toBe(22_000_000);
  });
});


describe('calcTaxableRetirementIncome: 課税退職所得金額', () => {
  it('勤続1年・退職金50万円は控除以下で課税0', () => {
    const result = calcTaxableRetirementIncome(500_000, 800_000, false, 1);
    expect(result.amount).toBe(0);
  });

  it('勤続40年・退職金3000万円（一般）: 課税400万円', () => {
    // 控除 2200万、afterDeduction 800万、×1/2 = 400万
    const result = calcTaxableRetirementIncome(30_000_000, 22_000_000, false, 40);
    expect(result.amount).toBe(4_000_000);
    expect(result.category).toBe('general');
  });

  it('勤続5年・役員・退職金600万円: 特例（1/2なし）で課税400万', () => {
    // 控除 200万、afterDeduction 400万、1/2なし → 400万
    const result = calcTaxableRetirementIncome(6_000_000, 2_000_000, true, 5);
    expect(result.amount).toBe(4_000_000);
    expect(result.category).toBe('specificExecutive');
  });

  it('勤続5年・一般・退職金1000万円（短期退職、300万超）: 課税650万', () => {
    // 控除 200万、afterDeduction 800万 > 300万
    // 150万 + (1000万 - (300万 + 200万)) = 150万 + 500万 = 650万
    const result = calcTaxableRetirementIncome(10_000_000, 2_000_000, false, 5);
    expect(result.amount).toBe(6_500_000);
    expect(result.category).toBe('shortTermOver300');
  });

  it('勤続5年・一般・退職金400万円（短期退職、300万以下）: 通常の1/2課税', () => {
    // 控除 200万、afterDeduction 200万 ≤ 300万、×1/2 = 100万
    const result = calcTaxableRetirementIncome(4_000_000, 2_000_000, false, 5);
    expect(result.amount).toBe(1_000_000);
    expect(result.category).toBe('shortTermUnder300');
  });

  it('1,000円未満切り捨てが効く: 課税3,001,500円 → 3,001,000円', () => {
    // 控除800万、retire 1400万3千円 → afterDed 6,003,000 ÷ 2 = 3,001,500 → 切り捨て 3,001,000
    const result = calcTaxableRetirementIncome(14_003_000, 8_000_000, false, 20);
    expect(result.amount).toBe(3_001_000);
  });
});

describe('calcIncomeTax: 所得税額（復興特別所得税込み）', () => {
  it('課税0円は税0', () => {
    expect(calcIncomeTax(0)).toBe(0);
  });
  it('課税100万円: 50,000 × 1.021 = 51,050円', () => {
    // 100万 × 5% - 0 = 50,000、×1.021 = 51,050
    expect(calcIncomeTax(1_000_000)).toBe(51_050);
  });
  it('課税400万円: (400万×20% - 42.75万) × 1.021 = 380,329円', () => {
    // 400万 × 20% - 427,500 = 372,500、×1.021 = 380,322.5 → 切り捨て 380,322
    // ※微妙な丸めずれの可能性あり、JS浮動小数点
    const result = calcIncomeTax(4_000_000);
    // 期待: floor(372500 * 1.021) = floor(380322.5) = 380322
    expect(result).toBe(380_322);
  });
  it('各税率区分の上限（10%〜45%・復興特別所得税込み）', () => {
    // 速算表（課税×率 − 控除）＋ 復興特別所得税 2.1% を実出力で固定
    expect(calcIncomeTax(3_300_000)).toBe(237_382); // 10%区分上限
    expect(calcIncomeTax(9_000_000)).toBe(1_464_114); // 23%区分上限
    expect(calcIncomeTax(18_000_000)).toBe(4_496_484); // 33%区分上限
    expect(calcIncomeTax(40_000_000)).toBe(13_481_284); // 40%区分上限
    expect(calcIncomeTax(50_000_000)).toBe(18_075_784); // 45%区分（Infinity）
  });
});

describe('calcResidentTax: 住民税', () => {
  it('課税0円は税0', () => {
    expect(calcResidentTax(0)).toBe(0);
  });
  it('課税100万円: 10万円', () => {
    expect(calcResidentTax(1_000_000)).toBe(100_000);
  });
  it('課税400万円: 40万円', () => {
    expect(calcResidentTax(4_000_000)).toBe(400_000);
  });
  it('課税3,001,000円: 300,100円（100円未満切り捨て）', () => {
    expect(calcResidentTax(3_001_000)).toBe(300_100);
  });
});


describe('calcAll: 統合計算', () => {
  it('勤続40年・退職金3000万円・一般従業員', () => {
    const result = calcAll({
      retirementAmount: 30_000_000,
      yearsOfService: 40,
      isExecutive: false,
    });
    expect(result.effectiveYears).toBe(40);
    expect(result.retirementDeduction).toBe(22_000_000);
    expect(result.taxableRetirementIncome).toBe(4_000_000);
    expect(result.incomeTax).toBe(380_322);
    expect(result.residentTax).toBe(400_000);
    expect(result.totalTax).toBe(780_322);
    expect(result.netAmount).toBe(30_000_000 - 780_322);
    expect(result.category).toBe('general');
  });

  it('勤続1年・退職金50万円: 完全非課税', () => {
    const result = calcAll({
      retirementAmount: 500_000,
      yearsOfService: 1,
      isExecutive: false,
    });
    expect(result.retirementDeduction).toBe(800_000);
    expect(result.taxableRetirementIncome).toBe(0);
    expect(result.totalTax).toBe(0);
    expect(result.netAmount).toBe(500_000);
  });

  it('勤続19年5ヶ月・退職金800万円: 端数月で20年扱い', () => {
    const result = calcAll({
      retirementAmount: 8_000_000,
      yearsOfService: 19,
      monthsOfService: 5,
      isExecutive: false,
    });
    expect(result.effectiveYears).toBe(20);
    expect(result.retirementDeduction).toBe(8_000_000); // 20年分
    expect(result.taxableRetirementIncome).toBe(0); // 控除と同額
    expect(result.totalTax).toBe(0);
  });
});

describe('compareWithOneMoreYear: 「あと1年勤めると」比較（差別化要素A）', () => {
  it('勤続20年→21年の境界跨ぎ: 控除額差70万円', () => {
    const comp = compareWithOneMoreYear({
      retirementAmount: 30_000_000,
      yearsOfService: 20,
      isExecutive: false,
    });
    // 20年: 控除800万、21年: 控除870万、差70万
    expect(comp.deductionDiff).toBe(700_000);
    // 課税所得が減るため、税額も減る = 節税効果
    expect(comp.totalTaxDiff).toBeGreaterThan(0);
    // 手取りは増える
    expect(comp.netAmountDiff).toBeGreaterThan(0);
  });

  it('勤続19年→20年の境界以下: 控除額差40万円', () => {
    const comp = compareWithOneMoreYear({
      retirementAmount: 15_000_000,
      yearsOfService: 19,
      isExecutive: false,
    });
    // 19年: 760万、20年: 800万、差40万
    expect(comp.deductionDiff).toBe(400_000);
  });
});

describe('validateInput: 入力検証', () => {
  it('正常な入力はエラーなし', () => {
    const errors = validateInput({
      retirementAmount: 10_000_000,
      yearsOfService: 30,
      isExecutive: false,
    });
    expect(errors).toEqual([]);
  });

  it('退職金額未入力はエラー', () => {
    const errors = validateInput({
      yearsOfService: 30,
      isExecutive: false,
    });
    expect(errors.some((e) => e.field === 'retirementAmount')).toBe(true);
  });

  it('負の勤続年数はエラー', () => {
    const errors = validateInput({
      retirementAmount: 10_000_000,
      yearsOfService: -5,
      isExecutive: false,
    });
    expect(errors.some((e) => e.field === 'yearsOfService')).toBe(true);
  });

  it('勤続年数の小数はエラー（端数は月数で）', () => {
    const errors = validateInput({
      retirementAmount: 10_000_000,
      yearsOfService: 30.5,
      isExecutive: false,
    });
    expect(errors.some((e) => e.field === 'yearsOfService')).toBe(true);
  });

  it('勤続月数が12以上はエラー', () => {
    const errors = validateInput({
      retirementAmount: 10_000_000,
      yearsOfService: 30,
      monthsOfService: 12,
      isExecutive: false,
    });
    expect(errors.some((e) => e.field === 'monthsOfService')).toBe(true);
  });
});


// ============================================================
// 記事 worked example の裏取り（auto-worker v2.5 品質ゲート①）
// 記事本文の金額例と同じ入力・期待値をここで固定し、誤値を CI で落とす。
// ============================================================

describe('記事 worked example: 申告書出し忘れ（Q3 / dc-... 記事の数値の裏取り）', () => {
  // 退職金2,000万円・勤続30年・一般（記事 forgot-declaration-form の例）
  const input = { retirementAmount: 20_000_000, yearsOfService: 30, isExecutive: false };

  it('申告書提出（正規）: 課税250万・所得税155,702・住民税250,000・税合計405,702・手取り19,594,298', () => {
    const r = calcAll(input);
    expect(r.taxableRetirementIncome).toBe(2_500_000);
    expect(r.incomeTax).toBe(155_702);
    expect(r.residentTax).toBe(250_000);
    expect(r.totalTax).toBe(405_702);
    expect(r.netAmount).toBe(19_594_298);
  });

  it('申告書未提出: 20.42%源泉 = 4,084,000', () => {
    expect(calcWithholdingWithoutDeclaration(20_000_000)).toBe(4_084_000);
  });

  it('出し忘れの過大源泉 = 4,084,000 − 405,702 = 3,678,298（確定申告で精算可）', () => {
    const proper = calcAll(input).totalTax;
    const withheld = calcWithholdingWithoutDeclaration(20_000_000);
    expect(withheld - proper).toBe(3_678_298);
  });

  it('未提出源泉は退職金0円で0円', () => {
    expect(calcWithholdingWithoutDeclaration(0)).toBe(0);
  });
});

describe('記事 worked example: 一時金の税額（Q4 / lump-sum-vs-pension 記事の数値の裏取り）', () => {
  // 退職金1,500万円・勤続25年・一般
  it('課税175万・所得税89,337・住民税175,000・税合計264,337・手取り14,735,663', () => {
    const r = calcAll({ retirementAmount: 15_000_000, yearsOfService: 25, isExecutive: false });
    expect(r.taxableRetirementIncome).toBe(1_750_000);
    expect(r.incomeTax).toBe(89_337);
    expect(r.residentTax).toBe(175_000);
    expect(r.totalTax).toBe(264_337);
    expect(r.netAmount).toBe(14_735_663);
  });
});


describe('記事 worked example: 役員退職金（executive-retirement 記事の数値の裏取り）', () => {
  // 勤続5年・役員・退職金600万円 → 特定役員退職手当等（1/2なし）
  it('役員: 課税400万・税合計780,322・手取り5,219,678', () => {
    const r = calcAll({ retirementAmount: 6_000_000, yearsOfService: 5, isExecutive: true });
    expect(r.taxableRetirementIncome).toBe(4_000_000);
    expect(r.category).toBe('specificExecutive');
    expect(r.totalTax).toBe(780_322);
    expect(r.netAmount).toBe(5_219_678);
  });
});

describe('記事 worked example: 短期退職手当等（short-term-retirement 記事の数値の裏取り）', () => {
  // 勤続5年・一般・退職金1000万円 → 短期・控除後800万>300万 → 300万超に1/2効かず
  it('短期300万超: 課税650万・税合計1,540,822・手取り8,459,178', () => {
    const r = calcAll({ retirementAmount: 10_000_000, yearsOfService: 5, isExecutive: false });
    expect(r.taxableRetirementIncome).toBe(6_500_000);
    expect(r.category).toBe('shortTermOver300');
    expect(r.totalTax).toBe(1_540_822);
    expect(r.netAmount).toBe(8_459_178);
  });
});


describe('記事 worked example: iDeCo同年受取（idct-same-year 記事の退職金側の裏取り）', () => {
  // 勤続20年・一般・退職金1,000万円（iDeCo同年受取記事の退職金ベースライン）
  it('課税100万・税合計151,050・手取り9,848,950', () => {
    const r = calcAll({ retirementAmount: 10_000_000, yearsOfService: 20, isExecutive: false });
    expect(r.retirementDeduction).toBe(8_000_000);
    expect(r.taxableRetirementIncome).toBe(1_000_000);
    expect(r.totalTax).toBe(151_050);
    expect(r.netAmount).toBe(9_848_950);
  });
});

describe('記事 worked example: 自己都合vs会社都合（reason-and-tax 記事の裏取り）', () => {
  // 退職理由は税額計算に影響しない（separationReason は UI 用）
  const base = { retirementAmount: 5_000_000, yearsOfService: 10, isExecutive: false };
  it('自己都合・会社都合で税額は同一（勤続10年・500万で税75,525・手取り4,924,475）', () => {
    const voluntary = calcAll({ ...base, separationReason: 'voluntary' });
    const involuntary = calcAll({ ...base, separationReason: 'involuntary' });
    expect(voluntary.totalTax).toBe(75_525);
    expect(voluntary.netAmount).toBe(4_924_475);
    expect(involuntary.totalTax).toBe(voluntary.totalTax);
    expect(involuntary.netAmount).toBe(voluntary.netAmount);
    expect(involuntary.taxableRetirementIncome).toBe(voluntary.taxableRetirementIncome);
  });
});
