/**
 * H4/H5: iDeCo の2つのモデルを画面につないだ部分のテスト。
 *
 * 計算そのものは limits.test.ts / receipt-comparison.test.ts が条文と告示で固定している。
 * ここで見るのは「画面が計算結果をそのまま出しているか」と
 * 「区分によって意味を持たない入力を出していないか」。
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  idecoMonthlyLimit,
  idecoAnnualLimit,
  COMBINED_MONTHLY_CAP,
  IDECO_MONTHLY_LIMIT,
} from './limits';
import { compareReceiptMethods } from './receipt-comparison';
import { BOUND_BY_LABEL } from '../../components/ideco/ContributionLimit';

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8');
const limitSrc = read('../../components/ideco/ContributionLimit.tsx');
const receiptSrc = read('../../components/ideco/ReceiptCompare.tsx');
const calcSrc = read('../../components/ideco/Calculator.tsx');

describe('H5: 拠出限度額', () => {
  it('画面に置かれている', () => {
    expect(calcSrc).toMatch(/<ContributionLimit\s*\/>/);
  });

  it('上限を決めた理由をすべて説明できる（boundBy の全値に文言がある）', () => {
    const seen = new Set<string>();
    for (const input of [
      { category: 'second' as const, hasCorporatePlan: false },
      {
        category: 'second' as const,
        hasCorporatePlan: true,
        corporateDcEmployerContribution: 50_000,
      },
      { category: 'first' as const, kokuminNenkinFundContribution: 60_000 },
    ]) {
      seen.add(idecoMonthlyLimit(input).boundBy);
    }
    expect([...seen].sort()).toEqual(Object.keys(BOUND_BY_LABEL).sort());
    for (const label of Object.values(BOUND_BY_LABEL)) {
      expect(label.length).toBeGreaterThan(5);
    }
  });

  it('合計枠に縛られるケースでは区分上限より小さくなる（画面が両方出す理由）', () => {
    const r = idecoMonthlyLimit({
      category: 'second',
      hasCorporatePlan: true,
      corporateDcEmployerContribution: 50_000,
    });
    expect(r.boundBy).toBe('combinedCap');
    expect(r.limit).toBeLessThan(r.baseLimit);
    expect(r.baseLimit).toBe(IDECO_MONTHLY_LIMIT.secondWithCorporatePlan);
    expect(r.combinedRoomRemaining).toBe(COMBINED_MONTHLY_CAP - 50_000);
    // 主役の数字は limit で、baseLimit は「区分だけなら」の補足にしか出ない。
    // 同じ結果オブジェクトの2つの値が別の役割で出るので、役割ごとに位置まで照合する
    // （#152 で同型の変異が素通りした＝存在検査だけでは主役の取り違えを止められない）。
    expect(limitSrc).toMatch(/月 \{yen\(result\.limit\)\}/);
    expect(limitSrc).toMatch(/区分だけなら月\{yen\(result\.baseLimit\)\}/);
    expect(limitSrc).toContain('result.combinedRoomRemaining');
  });

  it('年額は lib から取っており、画面で12倍していない', () => {
    expect(idecoAnnualLimit({ category: 'third' })).toBe(IDECO_MONTHLY_LIMIT.third * 12);
    expect(limitSrc).toContain('idecoAnnualLimit');
    expect(limitSrc).not.toMatch(/\*\s*12/);
  });

  it('区分で意味を持たない入力は出さない', () => {
    // 企業年金の入力は第2号のときだけ、国民年金基金は第1号・任意加入のときだけ
    expect(limitSrc).toMatch(/const showCorporate = category === "second"/);
    expect(limitSrc).toMatch(/const showFund = category === "first" \|\| category === "voluntary"/);
    expect(limitSrc).toMatch(/\{showCorporate && \(/);
    expect(limitSrc).toMatch(/\{showFund && \(/);
  });

  it('区分ごとの上限を直書きせず定数から描画している', () => {
    for (const literal of ['68,000', '23,000', '20,000', '55,000']) {
      expect(limitSrc).not.toContain(literal);
    }
    expect(limitSrc).toContain('IDECO_MONTHLY_LIMIT.first');
    expect(limitSrc).toContain('COMBINED_MONTHLY_CAP');
  });
});

describe('H4: 受取方法の比較', () => {
  it('画面に置かれている', () => {
    expect(calcSrc).toMatch(/<ReceiptCompare\s*\/>/);
  });

  it('勝敗と差額を lib の判定そのままで出している', () => {
    const c = compareReceiptMethods({
      idecoAmount: 8_000_000,
      contributionYears: 15,
      annuityYears: 5,
      publicPensionPerYear: 1_800_000,
      receiptStartAge: 65,
    });
    expect(c.winner).toBe('lumpSum');
    expect(c.differenceInNet).toBeGreaterThan(0);
    expect(receiptSrc).toContain('c.winner');
    expect(receiptSrc).toContain('c.differenceInNet');
    // 手取り・税額は結果から取る（画面で引き算しない）
    expect(receiptSrc).toContain('c.lumpSum.net');
    expect(receiptSrc).toContain('c.annuity.net');
    expect(receiptSrc).toContain('c.lumpSum.totalTax');
    expect(receiptSrc).toContain('c.annuity.totalTax');
  });

  it('同額のときは差額を出さない', () => {
    expect(receiptSrc).toMatch(/c\.winner !== "tie" && \(/);
  });

  it('年ごとの内訳を出している（65歳をまたぐと控除が変わるため）', () => {
    const c = compareReceiptMethods({
      idecoAmount: 6_000_000,
      contributionYears: 20,
      annuityYears: 10,
      publicPensionPerYear: 1_800_000,
      receiptStartAge: 60,
    });
    expect(c.annuity.schedule).toHaveLength(10);
    const ages = c.annuity.schedule.map((y) => y.age);
    expect(ages[0]).toBe(60);
    expect(ages).toContain(65);
    // 公的年金は65歳から乗るので、その前後で内訳が変わる
    expect(c.annuity.schedule[0].publicPension).toBe(0);
    expect(c.annuity.schedule[5].publicPension).toBe(1_800_000);
    expect(receiptSrc).toMatch(/c\.annuity\.schedule\.map\(/);
  });

  it('分割年数と受取開始年齢は1未満にならない（0除算・空スケジュールを作らない）', () => {
    expect(receiptSrc).toMatch(/Math\.max\(1, toInt\(annuityYears\)\)/);
    expect(receiptSrc).toMatch(/Math\.max\(1, toInt\(startAge\)\)/);
  });
});
