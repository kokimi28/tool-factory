/**
 * H6/H7: 在職老齢年金と加給年金・振替加算を画面につないだ部分のテスト。
 *
 * 計算そのものは zaishoku.test.ts / kakyu.test.ts が条文と表で固定している。
 * ここで見るのは「画面が結果をそのまま出しているか」と
 * 「これまで免責で逃げていた記述が、実態に合う形に直っているか」。
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  zaishokuPensionSuspension,
  suspensionThreshold,
  SUSPENSION_THRESHOLD_SCHEDULE,
  ZAISHOKU_CHECKED_AT,
} from './zaishoku';
import { kakyuPension, furikaeKasan, KAKYU_AMOUNT } from './kakyu';

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8');
const workSrc = read('../../components/nenkin-kuriage/WorkingPension.tsx');
const famSrc = read('../../components/nenkin-kuriage/FamilyAddition.tsx');
const calcSrc = read('../../components/nenkin-kuriage/Calculator.tsx');

describe('H6: 在職老齢年金', () => {
  it('画面に置かれている', () => {
    expect(calcSrc).toMatch(/<WorkingPension asOf=\{asOf\} \/>/);
  });

  it('既定の判定日は最新の基準額の側にある', () => {
    expect(ZAISHOKU_CHECKED_AT).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const latest = SUSPENSION_THRESHOLD_SCHEDULE[SUSPENSION_THRESHOLD_SCHEDULE.length - 1]!;
    expect(suspensionThreshold(ZAISHOKU_CHECKED_AT).threshold).toBe(latest.threshold);
  });

  it('停止あり・なしで別の文言を出す（片方しか描けていない状態を作らない）', () => {
    const none = zaishokuPensionSuspension(
      { basicMonthly: 100_000, totalCompensationMonthly: 300_000 },
      ZAISHOKU_CHECKED_AT,
    );
    const some = zaishokuPensionSuspension(
      { basicMonthly: 100_000, totalCompensationMonthly: 700_000 },
      ZAISHOKU_CHECKED_AT,
    );
    expect(none.suspended).toBe(0);
    expect(some.suspended).toBeGreaterThan(0);
    expect(workSrc).toMatch(/result\.suspended > 0 \? \(/);
    expect(workSrc).toContain('停止はありません');
    expect(workSrc).toContain('result.fullySuspended');
  });

  it('停止額は基本月額を超えない（全部停止で頭打ち）', () => {
    const r = zaishokuPensionSuspension(
      { basicMonthly: 50_000, totalCompensationMonthly: 3_000_000 },
      ZAISHOKU_CHECKED_AT,
    );
    expect(r.suspended).toBe(50_000);
    expect(r.paid).toBe(0);
    expect(r.fullySuspended).toBe(true);
  });

  it('基準額を直書きせず改定履歴から描画している', () => {
    for (const literal of ['510,000', '650,000', '令和7年度', '令和8年度']) {
      expect(workSrc).not.toContain(literal);
    }
    expect(workSrc).toContain('SUSPENSION_THRESHOLD_SCHEDULE.map');
    expect(workSrc).toContain('result.thresholdLabel');
  });

  it('判定日は定数で描画してからマウント後に今日へ差し替える', () => {
    expect(calcSrc).toContain('useState(ZAISHOKU_CHECKED_AT)');
    expect(calcSrc).toMatch(/setAsOf\(new Date\(\)\.toISOString\(\)\.slice\(0, 10\)\)/);
  });
});

describe('H7: 加給年金・振替加算', () => {
  it('画面に置かれている', () => {
    expect(calcSrc).toMatch(/<FamilyAddition \/>/);
  });

  it('特別加算は本人の生年月日、振替加算は配偶者の生年月日で決まる（取り違えない）', () => {
    const recipient = '1960-05-01';
    const spouse = '1962-05-01';
    const k = kakyuPension({
      hasEligibleSpouse: true,
      eligibleChildCount: 0,
      recipientBirthDate: recipient,
    });
    expect(k.spouseSpecialAddition).toBeGreaterThan(0);
    expect(k.spouseTotal).toBe(KAKYU_AMOUNT.spouse + k.spouseSpecialAddition);
    expect(furikaeKasan(spouse)).toBeGreaterThan(0);
    // 画面も同じ引数の対応で呼んでいる
    expect(famSrc).toMatch(/recipientBirthDate:\s*birthDate/);
    expect(famSrc).toMatch(/furikaeKasan\(spouseBirthDate\)/);
  });

  it('振替加算の対象外（昭和41年4月2日以後生まれ）は0で、画面も別の文言にする', () => {
    expect(furikaeKasan('1966-04-02')).toBe(0);
    expect(famSrc).toMatch(/furikae > 0 \? \(/);
    expect(famSrc).toContain('振替加算の対象外');
  });

  it('子の単価を直書きせず定数から描画している', () => {
    expect(famSrc).toContain('KAKYU_AMOUNT.childFirstSecond');
    expect(famSrc).toContain('KAKYU_AMOUNT.childThirdOnward');
  });

  it('3人目以降が安いことをモデルが持っている（画面の説明の裏付け）', () => {
    const two = kakyuPension({
      hasEligibleSpouse: false,
      eligibleChildCount: 2,
      recipientBirthDate: '1960-05-01',
    });
    const three = kakyuPension({
      hasEligibleSpouse: false,
      eligibleChildCount: 3,
      recipientBirthDate: '1960-05-01',
    });
    expect(three.childrenTotal - two.childrenTotal).toBe(KAKYU_AMOUNT.childThirdOnward);
    expect(KAKYU_AMOUNT.childThirdOnward).toBeLessThan(KAKYU_AMOUNT.childFirstSecond);
  });
});

describe('免責の文言が実態に合っている', () => {
  it('「含めていません」と言い切ったままにしない（別の計算で見られると書く）', () => {
    expect(calcSrc).not.toContain('加給年金・振替加算・在職老齢年金は含めていません');
    expect(calcSrc).toContain('上の損益分岐の計算には含めていません（下の2つの計算で別に確認できます）');
  });
});
