/**
 * iDeCo 一時金 vs 年金の実額比較（G3）のテスト。
 *
 * この計算は既存の2つの実装（退職所得＝lib/ideco/calculations.ts、
 * 公的年金等＝lib/nenkin-kuriage/net.ts）を組み合わせただけなので、
 * テストの役目は「組み合わせ方」を守ること:
 *  ① 一時金側が既存の実装・記事と同じ額を出す（別実装になっていない）
 *  ② 年金側が「公的年金と合算した税 − 公的年金だけの税」の差分になっている
 *  ③ 65歳をまたぐ分割で年ごとに控除が切り替わる（1区分で済ませていない）
 *  ④ どちらが勝つかの向き（記事が主張する条件）
 *  ⑤ 記事の数値が実装と一致している
 */
import { describe, expect, it } from 'vitest';

import { calcIncomeTax, calcResidentTax } from './calculations';
import { getArticle } from './articles';
import {
  annuityOutcome,
  compareReceiptMethods,
  lumpSumOutcome,
  type ReceiptComparisonInput,
} from './receipt-comparison';
import { pensionNet } from '../nenkin-kuriage/net';

/** 記事が使う標準ケース: iDeCo 800万円・加入15年 */
const BASE: ReceiptComparisonInput = { idecoAmount: 8_000_000, contributionYears: 15 };
const PUBLIC_PENSION = 1_800_000; // 65歳で月15万円（他ツールと揃えた標準例）

describe('一時金側は既存の実装と同じ額を出す', () => {
  it('加入15年・800万円 → 控除600万・課税100万・税151,050円', () => {
    const r = lumpSumOutcome(BASE);
    expect(r.deduction).toBe(6_000_000);
    expect(r.taxableIncome).toBe(1_000_000);
    expect(r.incomeTax).toBe(calcIncomeTax(1_000_000));
    expect(r.residentTax).toBe(calcResidentTax(1_000_000));
    expect(r.totalTax).toBe(151_050);
    expect(r.net).toBe(8_000_000 - 151_050);
  });

  it('退職金で使った分だけ退職所得控除の枠が減る（0未満にはならない）', () => {
    expect(lumpSumOutcome({ ...BASE, retirementDeductionAlreadyUsed: 2_000_000 }).deduction).toBe(4_000_000);
    expect(lumpSumOutcome({ ...BASE, retirementDeductionAlreadyUsed: 6_000_000 }).deduction).toBe(0);
    expect(lumpSumOutcome({ ...BASE, retirementDeductionAlreadyUsed: 99_000_000 }).deduction).toBe(0);
  });

  it('控除を使い切ると2分の1課税だけが残る（800万→課税400万）', () => {
    const r = lumpSumOutcome({ ...BASE, retirementDeductionAlreadyUsed: 6_000_000 });
    expect(r.taxableIncome).toBe(4_000_000);
    expect(r.totalTax).toBe(780_322);
  });
});

describe('年金側は「合算した税 − 公的年金だけの税」の差分になっている', () => {
  it('併給ありの1年ぶんが pensionNet の差と一致する', () => {
    const r = annuityOutcome({
      ...BASE,
      annuityYears: 5,
      publicPensionPerYear: PUBLIC_PENSION,
      receiptStartAge: 65,
    });
    const perYear = 8_000_000 / 5;
    const expected =
      pensionNet({ annualPension: PUBLIC_PENSION + perYear }).totalTax -
      pensionNet({ annualPension: PUBLIC_PENSION }).totalTax;
    expect(r.schedule[0]!.extraTax).toBe(expected);
    expect(r.totalTax).toBe(expected * 5);
  });

  it('公的年金が無い年は iDeCo だけで判定される', () => {
    const r = annuityOutcome({
      ...BASE,
      annuityYears: 5,
      publicPensionPerYear: PUBLIC_PENSION,
      receiptStartAge: 60, // 公的年金は65歳からなので全期間かからない
    });
    for (const row of r.schedule) expect(row.publicPension).toBe(0);
    expect(r.schedule[0]!.extraTax).toBe(pensionNet({ annualPension: 1_600_000, age65OrOver: false }).totalTax);
  });

  it('公的年金と重なると、同じ受取額でも税が跳ね上がる', () => {
    const overlap = annuityOutcome({ ...BASE, annuityYears: 5, publicPensionPerYear: PUBLIC_PENSION, receiptStartAge: 65 });
    const noOverlap = annuityOutcome({ ...BASE, annuityYears: 5, publicPensionPerYear: PUBLIC_PENSION, receiptStartAge: 60 });
    expect(overlap.totalTax).toBeGreaterThan(noOverlap.totalTax * 3);
  });
});

describe('65歳をまたぐ分割は年ごとに切り替わる', () => {
  const r = annuityOutcome({
    ...BASE,
    annuityYears: 10,
    publicPensionPerYear: PUBLIC_PENSION,
    receiptStartAge: 60,
  });

  it('60〜64歳と65〜69歳で負担が変わる（1区分で済ませていない）', () => {
    const before = r.schedule.filter((s) => s.age < 65);
    const after = r.schedule.filter((s) => s.age >= 65);
    expect(before).toHaveLength(5);
    expect(after).toHaveLength(5);
    expect(new Set(before.map((s) => s.extraTax)).size).toBe(1);
    expect(new Set(after.map((s) => s.extraTax)).size).toBe(1);
    expect(after[0]!.extraTax).toBeGreaterThan(before[0]!.extraTax);
  });

  it('年齢は開始年齢から1年ずつ増える', () => {
    expect(r.schedule.map((s) => s.age)).toEqual([60, 61, 62, 63, 64, 65, 66, 67, 68, 69]);
  });

  it('合計は年ごとの積み上げと一致する', () => {
    expect(r.totalTax).toBe(r.schedule.reduce((a, s) => a + s.extraTax, 0));
  });
});

describe('どちらが勝つか（記事が主張する条件）', () => {
  const cmp = (o: Partial<ReceiptComparisonInput>) =>
    compareReceiptMethods({ ...BASE, annuityYears: 5, publicPensionPerYear: PUBLIC_PENSION, ...o });

  it('退職所得控除が残っているなら一時金が勝つ（重なっても重ならなくても）', () => {
    expect(cmp({ receiptStartAge: 65 }).winner).toBe('lumpSum');
    expect(cmp({ receiptStartAge: 60 }).winner).toBe('lumpSum');
  });

  it('控除を使い切っていても、公的年金と重なるなら一時金が勝つ', () => {
    expect(cmp({ retirementDeductionAlreadyUsed: 6_000_000, receiptStartAge: 65 }).winner).toBe('lumpSum');
  });

  it('年金が勝つのは「控除を使い切り」かつ「公的年金と重ならない」を両方満たすとき', () => {
    expect(cmp({ retirementDeductionAlreadyUsed: 6_000_000, receiptStartAge: 60 }).winner).toBe('annuity');
  });

  it('片方だけでは足りない（2条件がANDであることの確認）', () => {
    // 控除は残っている × 重ならない → 一時金
    expect(cmp({ receiptStartAge: 60 }).winner).toBe('lumpSum');
    // 控除は使い切り × 重なる → 一時金
    expect(cmp({ retirementDeductionAlreadyUsed: 6_000_000, receiptStartAge: 65 }).winner).toBe('lumpSum');
  });

  it('differenceInNet は手取りの差の絶対値', () => {
    const r = cmp({ retirementDeductionAlreadyUsed: 6_000_000, receiptStartAge: 60 });
    expect(r.differenceInNet).toBe(Math.abs(r.lumpSum.net - r.annuity.net));
    expect(r.annuity.net).toBeGreaterThan(r.lumpSum.net);
  });
});

describe('異常入力', () => {
  it('負・NaN は0として扱い、分割年数は1年以上になる', () => {
    const r = compareReceiptMethods({ idecoAmount: Number.NaN, contributionYears: -3, annuityYears: 0 });
    expect(r.lumpSum.amount).toBe(0);
    expect(r.lumpSum.totalTax).toBe(0);
    expect(r.annuity.years).toBe(1);
    expect(r.annuity.totalTax).toBe(0);
  });
});

describe('記事 ideco-lump-sum-vs-pension（G3）の数値が実装と一致している', () => {
  const body = (() => {
    const a = getArticle('ideco-lump-sum-vs-pension');
    if (!a) throw new Error('article not found');
    return [
      a.title,
      a.description,
      a.lead,
      ...a.sections.flatMap((s) => [s.heading ?? '', ...s.paragraphs, ...(s.bullets ?? [])]),
      ...(a.faqs ?? []).flatMap((f) => [f.question, f.answer]),
    ].join('\n');
  })();

  const yen = (n: number): string => n.toLocaleString('en-US');
  const cmp = (o: Partial<ReceiptComparisonInput>) =>
    compareReceiptMethods({ ...BASE, annuityYears: 5, publicPensionPerYear: PUBLIC_PENSION, ...o });

  const A = cmp({ receiptStartAge: 65 });
  const C = cmp({ retirementDeductionAlreadyUsed: 6_000_000, receiptStartAge: 60 });

  it('一時金の税額と手取りを載せている', () => {
    expect(body).toContain(
      `税額は151,050円（所得税 ${yen(A.lumpSum.incomeTax)}円 + 住民税 ${yen(A.lumpSum.residentTax)}円）`,
    );
    expect(body).toContain(`手取りは${yen(A.lumpSum.net)}円`);
  });

  it('年金受取（公的年金と重なる標準ケース）の税と手取りを実額で載せている', () => {
    expect(body).toContain(
      `年${yen(Math.round(A.annuity.perYear))}円を5年間受け取ると、iDeCoの分だけ税が年${yen(A.annuity.schedule[0]!.extraTax)}円増え、5年で${yen(A.annuity.totalTax)}円`,
    );
    expect(body).toContain(`手取りは${yen(A.annuity.net)}円`);
  });

  it('標準ケースでは一時金が勝つことを差額つきで載せている', () => {
    expect(body).toContain(`一時金のほうが${yen(A.differenceInNet)}円多く残ります`);
  });

  it('年金が勝つ条件を、実額つきで載せている', () => {
    expect(body).toContain(
      `税は年${yen(C.annuity.schedule[0]!.extraTax)}円・5年で${yen(C.annuity.totalTax)}円にとどまり、手取りは${yen(C.annuity.net)}円`,
    );
    expect(body).toContain(`年金受取のほうが${yen(C.differenceInNet)}円多く残ります`);
  });

  it('「一律の正解はありません」で止めず、2条件を箇条書きで明示している', () => {
    // 条件そのものが記事の結論なので、本文のどこかに1回あればよい形にはしない。
    // body 全体への toContain だと、条件を挙げた箇条書きを消しても
    // 地の文や FAQ の同じ語が残って green になってしまう（変異で実証済み）。
    expect(body).not.toContain('一律の正解はありません');
    const a = getArticle('ideco-lump-sum-vs-pension')!;
    const bullets = a.sections.flatMap((sec) => sec.bullets ?? []);
    expect(bullets).toContain('条件1：退職所得控除を使い切っている（勤務先の退職金を先に一時金で受け取った）');
    expect(bullets).toContain('条件2：公的年金と重ならない時期（60〜64歳など）に受け取れる');
  });

  it('2条件が AND であることを本文が明言している', () => {
    expect(body).toContain('両方そろって初めて逆転します');
    expect(body).toContain('片方しか満たさない場合は逆転しません');
  });

  it('本文に出るすべての金額が、実装が出す値のいずれかと一致する', () => {
    // 同じ額が本文・箇条書き・FAQ に重複して載るため、全出現をまとめて検査する。
    const allowed = new Set<string>();
    for (const r of [A, C]) {
      for (const v of [
        r.lumpSum.amount, r.lumpSum.deduction, r.lumpSum.taxableIncome,
        r.lumpSum.incomeTax, r.lumpSum.residentTax, r.lumpSum.totalTax, r.lumpSum.net,
        r.annuity.totalTax, r.annuity.net, r.differenceInNet,
        Math.round(r.annuity.perYear), r.annuity.schedule[0]!.extraTax,
      ]) allowed.add(yen(v));
    }
    const found = [...body.matchAll(/\d{1,3}(?:,\d{3})+(?=円)/g)].map((m) => m[0]!);
    expect(found.length).toBeGreaterThanOrEqual(10);
    for (const f of found) expect([...allowed]).toContain(f);
  });

  it('レンダラが解釈しない markdown 記法が残っていない', () => {
    expect(body).not.toContain('**');
  });
});
