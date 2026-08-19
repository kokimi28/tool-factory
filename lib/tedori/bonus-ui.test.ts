/**
 * H2: 賞与の手取りを画面につないだ部分のテスト。
 *
 * 税額そのものは bonus.test.ts が告示の別表で固定しているので、ここでは
 * 「計算できないケースを、誤った数字でなく理由として返せているか」を見る。
 * bonus.ts はそのために例外を投げる設計なので、UI 層が握りつぶすと設計が無意味になる。
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { bonusOutcome, BONUS_UNSUPPORTED_MESSAGE } from './bonus-ui';
import { calculateBonusNetPay, requiresMonthlyTableMethod } from './bonus';

const OK = { bonusAmount: 500_000, previousMonthSalary: 250_000, isOver40: false };

describe('計算できる場合', () => {
  it('bonus.ts と同じ結果をそのまま返す（UI 層で数字を作らない）', () => {
    const out = bonusOutcome(OK);
    expect(out.kind).toBe('ok');
    if (out.kind !== 'ok') return;
    expect(out.result).toEqual(calculateBonusNetPay(OK));
  });

  it('住民税は賞与から引かれないので常に0', () => {
    const out = bonusOutcome(OK);
    expect(out.kind === 'ok' && out.result.residentTax).toBe(0);
  });

  it('介護保険の対象だと手取りが減る', () => {
    const under = bonusOutcome(OK);
    const over = bonusOutcome({ ...OK, isOver40: true });
    expect(under.kind === 'ok' && over.kind === 'ok').toBe(true);
    if (under.kind !== 'ok' || over.kind !== 'ok') return;
    expect(over.result.takeHome).toBeLessThan(under.result.takeHome);
  });
});

describe('算出率の表が使えない場合（告示別表第三 備考4）', () => {
  it('前月の給与がないときは例外でなく理由を返す', () => {
    const input = { ...OK, previousMonthSalary: 0 };
    expect(requiresMonthlyTableMethod(input)).toBe(true);
    expect(() => calculateBonusNetPay(input)).toThrow();
    expect(bonusOutcome(input)).toEqual({ kind: 'unsupported', reason: 'noPreviousSalary' });
  });

  it('賞与が前月給与の10倍を超えるときも理由を返す', () => {
    const input = { ...OK, bonusAmount: 5_000_000, previousMonthSalary: 100_000 };
    expect(requiresMonthlyTableMethod(input)).toBe(true);
    expect(bonusOutcome(input)).toEqual({ kind: 'unsupported', reason: 'bonusOverTenTimes' });
  });

  it('10倍ちょうどは計算できる（境界は「超える」）', () => {
    const prev = 100_000;
    // 社会保険料控除後の賞与が前月給与の10倍ちょうどになる額を production から求める
    let boundary = 0;
    for (let bonus = 1_000_000; bonus <= 1_300_000; bonus += 1_000) {
      if (!requiresMonthlyTableMethod({ ...OK, bonusAmount: bonus, previousMonthSalary: prev })) {
        boundary = bonus;
      } else break;
    }
    expect(boundary).toBeGreaterThan(1_000_000);
    expect(bonusOutcome({ ...OK, bonusAmount: boundary, previousMonthSalary: prev }).kind).toBe('ok');
    expect(
      bonusOutcome({ ...OK, bonusAmount: boundary + 1_000, previousMonthSalary: prev }).kind,
    ).toBe('unsupported');
  });

  it('賞与0円は「税額0」で計算できる（10倍ルールの対象外）', () => {
    const out = bonusOutcome({ ...OK, bonusAmount: 0, previousMonthSalary: 0 });
    expect(out.kind).toBe('ok');
    expect(out.kind === 'ok' && out.result.incomeTax).toBe(0);
  });

  it('どの理由にも、月額表が必要だと分かる説明がある', () => {
    for (const message of Object.values(BONUS_UNSUPPORTED_MESSAGE)) {
      expect(message).toContain('月額表');
      expect(message.length).toBeGreaterThan(40);
    }
  });

  it('理由の種類をすべて説明文が網羅している', () => {
    const reasons = new Set<string>();
    for (const input of [
      { ...OK, previousMonthSalary: 0 },
      { ...OK, bonusAmount: 5_000_000, previousMonthSalary: 100_000 },
    ]) {
      const out = bonusOutcome(input);
      if (out.kind === 'unsupported') reasons.add(out.reason);
    }
    expect([...reasons].sort()).toEqual(Object.keys(BONUS_UNSUPPORTED_MESSAGE).sort());
  });
});

describe('Calculator への配線', () => {
  const bonusSrc = readFileSync(
    new URL('../../components/tedori/BonusCalculator.tsx', import.meta.url),
    'utf8',
  );
  const calcSrc = readFileSync(
    new URL('../../components/tedori/Calculator.tsx', import.meta.url),
    'utf8',
  );

  it('画面に置かれている', () => {
    expect(calcSrc).toMatch(/<BonusCalculator\s*\/>/);
  });

  it('計算できない場合の分岐を描画している（握りつぶしていない）', () => {
    expect(bonusSrc).toMatch(/outcome\.kind === "unsupported"/);
    expect(bonusSrc).toContain('BONUS_UNSUPPORTED_MESSAGE[outcome.reason]');
  });

  it('金額は結果オブジェクトから出しており、画面で再計算していない', () => {
    expect(bonusSrc).not.toMatch(/[*+\-/]\s*0\.\d{2,}/);
    expect(bonusSrc).toContain('outcome.result.takeHome');
    expect(bonusSrc).toContain('outcome.result.healthNursingChildCareTotal');
  });

  it('住民税が0である理由を画面に書いている', () => {
    expect(bonusSrc).toContain('賞与からは引かれない');
  });
});
