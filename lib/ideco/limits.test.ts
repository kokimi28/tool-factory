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
import { getArticle } from './articles';
import { incomeTaxByBracket } from '../tedori/calculations';

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

describe('記事 ideco-kyoshutsu-gendo の数値が実装と一致している', () => {
  const body = (() => {
    const a = getArticle('ideco-kyoshutsu-gendo');
    if (!a) throw new Error('article not found');
    return [
      a.title,
      a.description,
      a.lead,
      ...a.sections.flatMap((s) => [s.heading, ...s.paragraphs, ...(s.bullets ?? [])]),
      ...a.faqs.flatMap((f) => [f.question, f.answer]),
    ].join('\n');
  })();

  const yen = (n: number): string => n.toLocaleString('en-US');
  /** 記事が前提にしている税率（所得税20%＋住民税10%）。所得税率は production の速算表から導出する。 */
  const marginalIncomeTaxRate = (() => {
    const t = 5_000_000; // 課税所得500万（330万超695万以下の区分）
    return (incomeTaxByBracket(t + 100_000) - incomeTaxByBracket(t)) / 100_000;
  })();
  const RESIDENT_RATE = 0.1;
  const totalRate = marginalIncomeTaxRate + RESIDENT_RATE;

  it('記事が前提にする所得税率は速算表と一致する（20%区分）', () => {
    expect(marginalIncomeTaxRate).toBeCloseTo(0.2, 10);
    expect(body).toContain(`所得税率${marginalIncomeTaxRate * 100}%`);
    expect(body).toContain(`住民税率${RESIDENT_RATE * 100}%`);
  });

  it('区分ごとの上限を月額と年額の対で載せている', () => {
    const rows: Array<[string, Parameters<typeof idecoMonthlyLimit>[0]]> = [
      ['第1号被保険者（自営業者等）', { category: 'first' }],
      ['第2号被保険者・企業年金なし（公務員を除く）', { category: 'second', hasCorporatePlan: false }],
      ['第2号被保険者・企業年金あり', { category: 'second', hasCorporatePlan: true }],
      ['第3号被保険者（専業主婦・主夫等）', { category: 'third' }],
      ['任意加入被保険者', { category: 'voluntary' }],
    ];
    for (const [label, input] of rows) {
      const m = idecoMonthlyLimit(input).limit;
      expect(body).toContain(`${label}：月${yen(m)}円（年${yen(idecoAnnualLimit(input))}円）`);
    }
  });

  it('合計枠が binding になる例を、事業主掛金・残り枠・上限の3点セットで載せている', () => {
    const of = (dc: number) =>
      idecoMonthlyLimit({ category: 'second', hasCorporatePlan: true, corporateDcEmployerContribution: dc });
    for (const dc of [35_000, 40_000, 55_000]) {
      const r = of(dc);
      expect(body).toContain(
        `事業主掛金 月${yen(dc)}円 → 残り${yen(r.combinedRoomRemaining!)}円 →`,
      );
    }
    // 40,000 のケースは本文でも実額を出している
    const r40 = of(40_000);
    expect(r40.boundBy).toBe('combinedCap');
    expect(body).toContain(
      `事業主掛金が月40,000円になると残りは15,000円しかなく、上限は月${yen(r40.limit)}円（年${yen(r40.limit * 12)}円）まで下がります`,
    );
  });

  it('公務員の残り枠と上限が実装と一致する（残り枠の全出現を検査）', () => {
    const r = idecoMonthlyLimit({
      category: 'second',
      hasCorporatePlan: true,
      otherPlanEquivalent: OTHER_PLAN_EQUIVALENT.nationalPublicServant,
    });
    expect(body).toContain(
      `${yen(OTHER_PLAN_EQUIVALENT.nationalPublicServant)}円が合計枠を消費しても残りは${yen(r.combinedRoomRemaining!)}円あるため、上限は区分上限どおり月${yen(r.limit)}円（年${yen(r.limit * 12)}円）です`,
    );
    // 「残りは○円」は本文とFAQに出るので全出現を検査する
    const hits = [...body.matchAll(/残りは([\d,]+)円あるため/g)].map((m) => m[1]);
    expect(hits.length).toBeGreaterThanOrEqual(1);
    for (const hit of hits) expect(hit).toBe(yen(r.combinedRoomRemaining!));
  });

  it('第1号の控除例が実装と一致する（本文とFAQの両方＝全出現を検査）', () => {
    const r = idecoMonthlyLimit({ category: 'first', kokuminNenkinFundContribution: 20_000 });
    // 同じ数値が本文とFAQの2箇所に出る。toContain だと片方を書き換えても
    // 他方が残っていて green のまま通ってしまう（変異テストで実際に素通りした）。
    // そこで「この言い回しの全出現」を取り出して、すべて正しい額であることを確認する。
    const hits = [...body.matchAll(/iDeCoに回せるのは月([\d,]+)円/g)].map((m) => m[1]);
    expect(hits.length).toBeGreaterThanOrEqual(2);
    for (const hit of hits) expect(hit).toBe(yen(r.limit));
  });

  it('節税額が「年間掛金 × 税率」で実装から導出できる', () => {
    const rows: Array<[string, Parameters<typeof idecoMonthlyLimit>[0]]> = [
      ['第2号・企業年金なし', { category: 'second', hasCorporatePlan: false }],
      ['第2号・企業年金あり', { category: 'second', hasCorporatePlan: true }],
      ['第1号', { category: 'first' }],
    ];
    for (const [label, input] of rows) {
      const annual = idecoAnnualLimit(input);
      const saving = Math.round(annual * totalRate);
      expect(body).toContain(`${label}：年${yen(annual)}円 → 節税 年${yen(saving)}円`);
    }
  });

  it('引き上げを反映していないことを読者に明示している', () => {
    expect(body).toContain('施行日が一次資料で確認できないため');
  });

  it('レンダラが解釈しない markdown 記法が残っていない', () => {
    expect(body).not.toContain('**');
  });
});
