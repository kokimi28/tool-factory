/**
 * 都道府県別 健康保険料率（D2）のテスト。
 *
 * 記事 tedori-todofuken-sa の金額はすべて production から導出して固定する
 * （記事からコピーした期待値は記事のコピーであって、何も証明しない）。
 *
 * シナリオは「入力（年収・県）と出力（手取り）」を 1 つの連続した文字列として
 * 照合する。数値を 1 つずつ確認する方式だと、県名だけ書き換えても
 * その数値が本文の別の場所にあれば green のまま通ってしまうため。
 */
import { describe, expect, it } from 'vitest';

import { getArticle } from './articles';
import { calculateNetSalary, socialInsurance } from './calculations';
import {
  NATIONAL_AVERAGE_HEALTH_RATE_P100K,
  PREFECTURES,
  PREFECTURE_HEALTH_RATE_P100K,
  RATE_EMP_P100K,
  prefectureHealthRateEmpP100K,
  type Prefecture,
} from './rates';

const yen = (n: number): string => n.toLocaleString('en-US');
/** 9_210 -> "9.21%" */
const pct = (p100k: number): string => `${(p100k / 1000).toFixed(2)}%`;

const bodyOf = (slug: string): string => {
  const a = getArticle(slug);
  if (!a) throw new Error(`article not found: ${slug}`);
  return [
    a.title,
    a.description,
    ...a.sections.flatMap((s) => [s.heading ?? '', ...s.paragraphs]),
  ].join('\n');
};

const take = (income: number, prefecture?: Prefecture): number =>
  calculateNetSalary({ annualIncome: income, isOver40: false, prefecture }).takeHome;

describe('都道府県テーブルの構造', () => {
  it('47支部そろっていて重複が無い', () => {
    expect(PREFECTURES).toHaveLength(47);
    expect(new Set(PREFECTURES).size).toBe(47);
    expect(Object.keys(PREFECTURE_HEALTH_RATE_P100K)).toHaveLength(47);
  });

  it('全支部が現実的な範囲（8%〜12%）に収まっている', () => {
    for (const p of PREFECTURES) {
      const r = PREFECTURE_HEALTH_RATE_P100K[p];
      expect(r).toBeGreaterThan(8_000);
      expect(r).toBeLessThan(12_000);
    }
  });

  it('折半しても整数のまま（小数第2位までなので10万分率は必ず偶数）', () => {
    for (const p of PREFECTURES) {
      expect(PREFECTURE_HEALTH_RATE_P100K[p] % 2).toBe(0);
      expect(Number.isInteger(prefectureHealthRateEmpP100K(p))).toBe(true);
    }
  });

  it('全国平均は単純平均ではない（加重平均なので一致しないのが正しい）', () => {
    const simpleMean =
      PREFECTURES.reduce((a, p) => a + PREFECTURE_HEALTH_RATE_P100K[p], 0) /
      PREFECTURES.length;
    expect(NATIONAL_AVERAGE_HEALTH_RATE_P100K).toBe(9_900);
    // 単純平均は 9.87% 前後。ここが一致したら誰かが平均を「直して」しまっている。
    expect(Math.round(simpleMean)).not.toBe(NATIONAL_AVERAGE_HEALTH_RATE_P100K);
    expect(simpleMean).toBeGreaterThan(9_800);
    expect(simpleMean).toBeLessThan(9_900);
  });

  it('全国平均は従業員負担率としても RATE_EMP_P100K.health と整合する', () => {
    expect(RATE_EMP_P100K.health).toBe(NATIONAL_AVERAGE_HEALTH_RATE_P100K / 2);
    expect(prefectureHealthRateEmpP100K()).toBe(RATE_EMP_P100K.health);
  });
});

describe('都道府県が効くのは健康保険料だけ', () => {
  const INCOME = 5_000_000;
  const low = socialInsurance(INCOME, true, '新潟県');
  const high = socialInsurance(INCOME, true, '佐賀県');

  it('健康保険料は県で変わる', () => {
    expect(low.health).not.toBe(high.health);
  });

  it('介護・支援金・厚年・雇用保険は県で変わらない（全国一律）', () => {
    expect(low.nursing).toBe(high.nursing);
    expect(low.childCare).toBe(high.childCare);
    expect(low.pension).toBe(high.pension);
    expect(low.employment).toBe(high.employment);
  });

  it('県を指定しなければ従来どおり全国平均（既存挙動を壊さない）', () => {
    expect(socialInsurance(INCOME, true)).toEqual(socialInsurance(INCOME, true, undefined));
    expect(socialInsurance(INCOME, true).health).toBe(
      Math.round(INCOME * (RATE_EMP_P100K.health / 100_000)),
    );
  });
});

describe('記事 tedori-todofuken-sa の数値ロック', () => {
  const body = bodyOf('tedori-todofuken-sa');
  const LOW: Prefecture = '新潟県';
  const HIGH: Prefecture = '佐賀県';

  it('最安・最高の県が実際にテーブルの最小・最大である', () => {
    const sorted = [...PREFECTURES].sort(
      (a, b) => PREFECTURE_HEALTH_RATE_P100K[a] - PREFECTURE_HEALTH_RATE_P100K[b],
    );
    expect(sorted[0]).toBe(LOW);
    expect(sorted[sorted.length - 1]).toBe(HIGH);
  });

  it('本文の料率はテーブルから導出した値と一致する', () => {
    expect(body).toContain(`${LOW}が${pct(PREFECTURE_HEALTH_RATE_P100K[LOW])}`);
    expect(body).toContain(`${HIGH}が${pct(PREFECTURE_HEALTH_RATE_P100K[HIGH])}`);
    expect(body).toContain(`東京都は${pct(PREFECTURE_HEALTH_RATE_P100K['東京都'])}`);
    expect(body).toContain(pct(NATIONAL_AVERAGE_HEALTH_RATE_P100K));
  });

  it('年収500万の手取りと差額を、県名まで含めて1つの連続文字列で載せている', () => {
    const lo = take(5_000_000, LOW);
    const hi = take(5_000_000, HIGH);
    // 県名を含めないと、県だけ書き換えても数値が本文の別箇所にあるため green のまま通る
    // （実際に変異テストで素通りしたので、この形に直した）。
    expect(body).toContain(
      `いちばん低い${LOW}といちばん高い${HIGH}を比べると、手取りは ${yen(lo)}円 と ${yen(hi)}円 で、差は年${yen(lo - hi)}円`,
    );
  });

  it('保険料の差と手取りの差が別物であることを正しい数値で説明している', () => {
    const loH = socialInsurance(5_000_000, false, LOW).health;
    const hiH = socialInsurance(5_000_000, false, HIGH).health;
    const lo = take(5_000_000, LOW);
    const hi = take(5_000_000, HIGH);
    // 保険料差 > 手取り差（社会保険料が所得控除になるため税で一部戻る）
    expect(hiH - loH).toBeGreaterThan(lo - hi);
    expect(body).toContain(`健康保険料そのものの差は ${yen(loH)}円 と ${yen(hiH)}円 で${yen(hiH - loH)}円`);
    expect(body).toContain(`それより小さい${yen(lo - hi)}円`);
  });

  it('他の年収の差額も production と一致する', () => {
    expect(body).toContain(`年収300万円なら差は${yen(take(3_000_000, LOW) - take(3_000_000, HIGH))}円`);
    expect(body).toContain(`年収800万円なら${yen(take(8_000_000, LOW) - take(8_000_000, HIGH))}円`);
  });

  it('全国一律の料率を本文が取り違えていない', () => {
    expect(body).toContain(`介護保険料（${pct(RATE_EMP_P100K.nursing * 2)}）`);
    expect(body).toContain(`子ども・子育て支援金（${pct(RATE_EMP_P100K.childCare * 2)}）`);
    expect(body).toContain(`厚生年金保険料（${(RATE_EMP_P100K.pension * 2 / 1000).toFixed(2)}%）`);
    // 雇用保険は労使折半ではないので労働者負担率をそのまま使う。末尾0を付けない自然な表記。
    expect(body).toContain(`労働者負担${RATE_EMP_P100K.employment / 1000}%`);
  });
});
