/**
 * iDeCo 拠出限度額（D9(a)）のテスト。
 *
 * 中心は「第2号・企業年金あり」のケース。区分上限20,000円と合計枠55,000円の**両方**が
 * 効き、小さい方が上限になる。片方だけ見る実装は過大に見積もるので、両方が binding に
 * なるケースを明示的に置く。
 */
import { describe, expect, it } from 'vitest';

import {
  COMBINED_MONTHLY_CAP,
  IDECO_MONTHLY_LIMIT,
  OTHER_PLAN_EQUIVALENT,
  idecoAnnualLimit,
  idecoMonthlyLimit,
} from './limits';

describe('第1号・任意加入（68,000円と国民年金基金等の控除）', () => {
  it('控除が無ければ68,000円', () => {
    expect(idecoMonthlyLimit({ category: 'first' }).limit).toBe(68_000);
    expect(idecoMonthlyLimit({ category: 'voluntary' }).limit).toBe(68_000);
  });

  it('国民年金基金の掛金・付加保険料はその額が控除される', () => {
    const r = idecoMonthlyLimit({ category: 'first', kokuminNenkinFundContribution: 20_000 });
    expect(r.limit).toBe(48_000);
    expect(r.boundBy).toBe('fundDeduction');
  });

  it('控除が上限を超えても負にならない', () => {
    expect(idecoMonthlyLimit({ category: 'first', kokuminNenkinFundContribution: 100_000 }).limit).toBe(0);
  });
});

describe('第3号（23,000円）', () => {
  it('常に23,000円', () => {
    expect(idecoMonthlyLimit({ category: 'third' }).limit).toBe(23_000);
    // 企業年金の有無は第3号には関係しない
    expect(idecoMonthlyLimit({ category: 'third', hasCorporatePlan: true }).limit).toBe(23_000);
  });
});

describe('第2号・企業年金なし（23,000円）', () => {
  it('23,000円', () => {
    const r = idecoMonthlyLimit({ category: 'second', hasCorporatePlan: false });
    expect(r.limit).toBe(23_000);
    expect(r.boundBy).toBe('category');
    expect(r.combinedRoomRemaining).toBeNull();
  });
});

describe('第2号・企業年金あり（20,000円と合計枠55,000円の小さい方）— D9 の本体', () => {
  it('企業型DC掛金が小さければ区分上限20,000円が効く', () => {
    const r = idecoMonthlyLimit({
      category: 'second',
      hasCorporatePlan: true,
      corporateDcEmployerContribution: 10_000,
    });
    expect(r.combinedRoomRemaining).toBe(45_000);
    expect(r.limit).toBe(20_000);
    expect(r.boundBy).toBe('category');
  });

  it('企業型DC掛金が大きいと合計枠の残りが上限になる', () => {
    // 事業主掛金40,000 → 残り15,000 だが 20,000 より小さいので 15,000 が上限
    const r = idecoMonthlyLimit({
      category: 'second',
      hasCorporatePlan: true,
      corporateDcEmployerContribution: 40_000,
    });
    expect(r.combinedRoomRemaining).toBe(15_000);
    expect(r.limit).toBe(15_000);
    expect(r.boundBy).toBe('combinedCap');
  });

  it('残り枠がちょうど20,000円のときは区分上限と一致する（境界）', () => {
    const r = idecoMonthlyLimit({
      category: 'second',
      hasCorporatePlan: true,
      corporateDcEmployerContribution: COMBINED_MONTHLY_CAP - 20_000,
    });
    expect(r.combinedRoomRemaining).toBe(20_000);
    expect(r.limit).toBe(20_000);
    expect(r.boundBy).toBe('category');
  });

  it('残り枠が19,999円になると合計枠が binding になる（境界の1円差）', () => {
    const r = idecoMonthlyLimit({
      category: 'second',
      hasCorporatePlan: true,
      corporateDcEmployerContribution: COMBINED_MONTHLY_CAP - 19_999,
    });
    expect(r.combinedRoomRemaining).toBe(19_999);
    expect(r.limit).toBe(19_999);
    expect(r.boundBy).toBe('combinedCap');
  });

  it('合計枠を使い切ると0円（拠出できない）', () => {
    const r = idecoMonthlyLimit({
      category: 'second',
      hasCorporatePlan: true,
      corporateDcEmployerContribution: COMBINED_MONTHLY_CAP,
    });
    expect(r.combinedRoomRemaining).toBe(0);
    expect(r.limit).toBe(0);
  });

  it('枠を超えて拠出されていても負にならない', () => {
    expect(
      idecoMonthlyLimit({
        category: 'second',
        hasCorporatePlan: true,
        corporateDcEmployerContribution: 80_000,
      }).limit,
    ).toBe(0);
  });

  it('他制度掛金相当額も合計枠を消費する（企業型DC掛金と合算）', () => {
    const r = idecoMonthlyLimit({
      category: 'second',
      hasCorporatePlan: true,
      corporateDcEmployerContribution: 30_000,
      otherPlanEquivalent: 10_000,
    });
    expect(r.combinedRoomRemaining).toBe(15_000);
    expect(r.limit).toBe(15_000);
  });

  it('公務員（共済＝他制度）は告示の8,000円が枠を消費し、上限は20,000円のまま', () => {
    const r = idecoMonthlyLimit({
      category: 'second',
      hasCorporatePlan: true,
      otherPlanEquivalent: OTHER_PLAN_EQUIVALENT.nationalPublicServant,
    });
    expect(r.combinedRoomRemaining).toBe(47_000);
    expect(r.limit).toBe(20_000);
  });
});

describe('告示の他制度掛金相当額', () => {
  it('一次資料どおりの額を持っている', () => {
    expect(OTHER_PLAN_EQUIVALENT.nationalPublicServant).toBe(8_000);
    expect(OTHER_PLAN_EQUIVALENT.localPublicServant).toBe(8_000);
    expect(OTHER_PLAN_EQUIVALENT.privateSchool).toBe(7_000);
    expect(OTHER_PLAN_EQUIVALENT.coalMining).toBe(9_000);
  });
});

describe('区分上限の定数が一次資料どおり', () => {
  it('68,000 / 23,000 / 20,000 / 23,000 / 68,000 と 合計枠 55,000', () => {
    expect(IDECO_MONTHLY_LIMIT.first).toBe(68_000);
    expect(IDECO_MONTHLY_LIMIT.secondWithoutCorporatePlan).toBe(23_000);
    expect(IDECO_MONTHLY_LIMIT.secondWithCorporatePlan).toBe(20_000);
    expect(IDECO_MONTHLY_LIMIT.third).toBe(23_000);
    expect(IDECO_MONTHLY_LIMIT.voluntary).toBe(68_000);
    expect(COMBINED_MONTHLY_CAP).toBe(55_000);
  });

  it('企業年金ありの上限は、なしの上限より小さい', () => {
    expect(IDECO_MONTHLY_LIMIT.secondWithCorporatePlan).toBeLessThan(
      IDECO_MONTHLY_LIMIT.secondWithoutCorporatePlan,
    );
  });
});

describe('年額換算', () => {
  it('月額の12倍', () => {
    expect(idecoAnnualLimit({ category: 'first' })).toBe(816_000);
    expect(idecoAnnualLimit({ category: 'second', hasCorporatePlan: false })).toBe(276_000);
    expect(
      idecoAnnualLimit({
        category: 'second',
        hasCorporatePlan: true,
        corporateDcEmployerContribution: 40_000,
      }),
    ).toBe(180_000);
  });
});

describe('異常入力', () => {
  it('負・NaN・Infinity は0として扱う', () => {
    for (const bad of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(
        idecoMonthlyLimit({
          category: 'second',
          hasCorporatePlan: true,
          corporateDcEmployerContribution: bad,
          otherPlanEquivalent: bad,
        }).limit,
      ).toBe(20_000);
      expect(
        idecoMonthlyLimit({ category: 'first', kokuminNenkinFundContribution: bad }).limit,
      ).toBe(68_000);
    }
  });
});
