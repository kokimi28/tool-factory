/**
 * 控除の内訳（所得税分・住民税基本分・住民税特例分）のテスト。
 *
 * 総務省の3本立ての式をそのまま実装しているので、テストの中心は
 * 「3つを足すと (寄付額 − 2,000) になる」という構造の検算と、
 * 特例分の20%上限（＝自己負担が2,000円を超え始める境目）。
 */
import { describe, expect, it } from 'vitest';

import {
  calcFurusatoLimit,
  donationDeductionBreakdown,
  marginalIncomeTaxRate,
  residentTaxLevy,
} from './calculations';
import { getArticle } from './articles';

describe('総務省の3本立ての式を再現する', () => {
  it('所得税分 = (寄付額−2,000) × 税率 × 1.021', () => {
    const taxable = 3_000_000;
    const donation = 77_197;
    const b = donationDeductionBreakdown(donation, taxable);
    const expected = Math.floor((donation - 2_000) * marginalIncomeTaxRate(taxable) * 1.021);
    expect(b.incomeTaxPortion).toBe(expected);
  });

  it('住民税基本分 = (寄付額−2,000) × 10%', () => {
    const b = donationDeductionBreakdown(77_197, 3_000_000);
    expect(b.residentBasicPortion).toBe(Math.floor((77_197 - 2_000) * 0.1));
  });

  it('特例分 = (寄付額−2,000) × (90% − 税率×1.021)（上限に当たらない範囲）', () => {
    const taxable = 3_000_000;
    const donation = 77_197;
    const rate = marginalIncomeTaxRate(taxable) * 1.021;
    const b = donationDeductionBreakdown(donation, taxable);
    expect(b.specialPortionCapped).toBe(false);
    expect(b.residentSpecialPortion).toBe(Math.floor((donation - 2_000) * (0.9 - rate)));
  });

  it('3つの合計は (寄付額−2,000) にほぼ一致する（切り捨て3回分だけ小さい）', () => {
    for (const taxable of [2_344_000, 3_000_000, 5_000_000, 8_000_000]) {
      const limit = calcFurusatoLimit(taxable).limit;
      const b = donationDeductionBreakdown(limit, taxable);
      const ideal = limit - 2_000;
      expect(b.totalDeduction).toBeLessThanOrEqual(ideal);
      // 3回の floor なので最大3円しか下回らない
      expect(ideal - b.totalDeduction).toBeLessThanOrEqual(3);
    }
  });

  it('上限まで寄付したときの自己負担は2,000円台に収まる（切り捨ての累積分だけ超える）', () => {
    for (const taxable of [2_344_000, 3_000_000, 5_000_000, 8_000_000]) {
      const limit = calcFurusatoLimit(taxable).limit;
      const b = donationDeductionBreakdown(limit, taxable);
      expect(b.selfPayment).toBeGreaterThanOrEqual(2_000);
      expect(b.selfPayment).toBeLessThanOrEqual(2_003);
      expect(b.specialPortionCapped).toBe(false);
    }
  });
});

describe('特例分の20%上限（自己負担が2,000円を超える境目）', () => {
  it('上限を大きく超える寄付では特例分が頭打ちになり自己負担が跳ね上がる', () => {
    const taxable = 3_000_000;
    const b = donationDeductionBreakdown(200_000, taxable);
    expect(b.specialPortionCapped).toBe(true);
    expect(b.residentSpecialPortion).toBe(Math.floor(residentTaxLevy(taxable) * 0.2));
    expect(b.selfPayment).toBeGreaterThan(2_000);
  });

  it('控除上限のすぐ下では上限に当たらない', () => {
    const taxable = 3_000_000;
    const limit = calcFurusatoLimit(taxable).limit;
    expect(donationDeductionBreakdown(limit - 1_000, taxable).specialPortionCapped).toBe(false);
  });
});

describe('D11: 住宅ローン控除と取り合うのは「所得税分」だけ', () => {
  it('所得税分は控除全体のごく一部である（税率10%区分で1割前後）', () => {
    const taxable = 3_000_000;
    const limit = calcFurusatoLimit(taxable).limit;
    const b = donationDeductionBreakdown(limit, taxable);
    expect(b.incomeTaxPortion).toBeGreaterThan(0);
    expect(b.incomeTaxPortion / b.totalDeduction).toBeLessThan(0.2);
  });

  it('税率が高いほど所得税分（＝取り合う額）が大きくなる', () => {
    const low = (() => {
      const t = 3_000_000;
      return donationDeductionBreakdown(calcFurusatoLimit(t).limit, t);
    })();
    const high = (() => {
      const t = 8_000_000;
      return donationDeductionBreakdown(calcFurusatoLimit(t).limit, t);
    })();
    expect(high.incomeTaxPortion).toBeGreaterThan(low.incomeTaxPortion);
  });
});

describe('異常入力', () => {
  it('寄付額が2,000円以下なら控除はゼロ', () => {
    for (const d of [0, 1_000, 2_000, -5, Number.NaN]) {
      const b = donationDeductionBreakdown(d, 3_000_000);
      expect(b.totalDeduction).toBe(0);
    }
  });

  it('課税所得ゼロなら特例分は0（住民税所得割が無い）', () => {
    const b = donationDeductionBreakdown(50_000, 0);
    expect(b.residentSpecialPortion).toBe(0);
    expect(b.specialPortionCapped).toBe(true);
  });
});

describe('記事 furusato-jutaku-loan の内訳が実装と一致している', () => {
  const body = (() => {
    const a = getArticle('furusato-jutaku-loan');
    if (!a) throw new Error('article not found');
    return [
      a.title,
      a.description,
      a.lead,
      ...a.sections.flatMap((s) => [s.heading, ...s.paragraphs, ...(s.bullets ?? [])]),
      ...(a.faqs ?? []).flatMap((f) => [f.question, f.answer]),
    ].join('\n');
  })();

  const yen = (n: number): string => n.toLocaleString('en-US');
  const TAXABLE = 3_000_000;
  const limit = calcFurusatoLimit(TAXABLE).limit;
  const b = donationDeductionBreakdown(limit, TAXABLE);

  it('3分割の内訳を production の値どおりに載せている', () => {
    expect(body).toContain(
      `内訳は所得税分${yen(b.incomeTaxPortion)}円・住民税基本分${yen(b.residentBasicPortion)}円・住民税特例分${yen(b.residentSpecialPortion)}円です`,
    );
  });

  it('「取り合うのは所得税分だけ」の額と、影響を受けない住民税分の額が正しい', () => {
    const residentTotal = b.residentBasicPortion + b.residentSpecialPortion;
    expect(body).toContain(
      `取り合うのはこのうち所得税分${yen(b.incomeTaxPortion)}円だけで、残りの${yen(residentTotal)}円は住民税から控除されるため影響を受けません`,
    );
  });

  it('所得税分の額は全出現で一致する（本文・bullet・description に重複して出る）', () => {
    const hits = [...body.matchAll(/所得税分([\d,]+)円/g)].map((m) => m[1]);
    expect(hits.length).toBeGreaterThanOrEqual(3);
    for (const hit of hits) expect(hit).toBe(yen(b.incomeTaxPortion));
  });

  it('実額を算出しない理由を読者に明示している', () => {
    expect(body).toContain('住宅ローン控除の控除可能額と居住開始年');
    expect(body).toContain('本サイトでは金額を算出していません');
  });

  it('レンダラが解釈しない markdown 記法が残っていない', () => {
    expect(body).not.toContain('**');
  });
});
