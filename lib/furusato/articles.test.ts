/**
 * furusato の記事本文ロック。
 *
 * なぜ必要か: furusato には記事本文を読むテストが1つも無かった。既存のテストは
 * 計算を二重化する（calcFurusatoLimit(300万) === 77,197 など）だけで、
 * 記事に書かれた数値そのものは一切照合していなかった。そのため記事の金額が
 * 実装とずれても全テスト green のまま公開される（nenshu-kabe が D5 まで
 * 抱えていたのと同じ欠落）。
 *
 * 規約:
 *  - 期待値はすべて production 関数から導出する（記事からコピーしない）
 *  - 同じ数値が複数箇所に出るのが普通なので `toContain` では不十分。
 *    言い回しの**全出現**を正規表現で取り出し、すべて正しい額であることを確認する
 *    （1箇所だけ書き換える変異は toContain では捕まらない）
 */
import { describe, expect, it } from 'vitest';

import { ARTICLES, getArticle } from './articles';
import { estimateFurusatoLimitFromSalary, calcFurusatoLimit } from './calculations';

const yen = (n: number): string => n.toLocaleString('en-US');

const bodyOf = (slug: string): string => {
  const a = getArticle(slug);
  if (!a) throw new Error(`article not found: ${slug}`);
  return [
    a.title,
    a.description,
    a.lead,
    ...a.sections.flatMap((s) => [s.heading, ...s.paragraphs, ...(s.bullets ?? [])]),
    ...(a.faqs ?? []).flatMap((f) => [f.question, f.answer]),
  ].join('\n');
};

/** 全記事を連結した本文（数値の横断チェック用）。 */
const allBody = ARTICLES.map((a) => bodyOf(a.slug)).join('\n');

describe('年収別の限度額が全記事で実装と一致している', () => {
  // 年収→限度額は複数の記事（早見・共働き・育休・計算式）に散らばって出てくる。
  // 「年収◯◯万円…上限 △△円」の言い回しの全出現を拾い、すべて production と一致させる。
  const incomes = [3_000_000, 5_000_000, 7_000_000, 10_000_000];

  it('published した限度額はすべて production の値である', () => {
    for (const income of incomes) {
      const expected = yen(estimateFurusatoLimitFromSalary({ annualIncome: income }).limit);
      // その限度額が本文に出るなら、必ず正しい額であること
      const man = income / 10_000;
      const re = new RegExp(`年収${man}万円[^。]*?上限[^0-9]{0,12}([\\d,]+)円`, 'g');
      const hits = [...allBody.matchAll(re)].map((m) => m[1]);
      for (const hit of hits) expect(hit).toBe(expected);
    }
  });

  it('少なくとも主要年収の限度額が記事に載っている（ロックが空振りしていない）', () => {
    // 上のテストは「出現があれば正しい」形なので、出現ゼロだと素通りする。
    // ロック自体が効いていることを確かめるため、実際に載っていることを確認する。
    for (const income of [5_000_000, 7_000_000]) {
      expect(allBody).toContain(yen(estimateFurusatoLimitFromSalary({ annualIncome: income }).limit));
    }
  });
});

describe('課税所得ベースの代表値が実装と一致している', () => {
  it('課税総所得金額300万円の上限が全出現で正しい', () => {
    const expected = yen(calcFurusatoLimit(3_000_000).limit);
    const hits = [...allBody.matchAll(/課税総所得金額300万円[^。]*?(?:上限|限度額)[^0-9]{0,12}([\d,]+)円/g)].map((m) => m[1]);
    for (const hit of hits) expect(hit).toBe(expected);
    // 住宅ローン控除の併用記事が使う代表値なので、載っていること自体も確認する
    expect(allBody).toContain(expected);
  });
});

describe('社会保険料の概算率の表記が実装と一致している', () => {
  it('本文の「約N%」が実装の率と一致する（全出現）', () => {
    // 記事・ツールページ・Calculator の3箇所に同じ率が出るため全出現を検査する。
    const hits = [...allBody.matchAll(/社会保険料（年収の約([\d.]+)%と概算）/g)].map((m) => m[1]);
    for (const hit of hits) {
      // 14.715% を小数第3位まで（末尾0は付けない自然な表記）
      expect(hit).toBe('14.715');
    }
  });

  it('旧値 14.75% が残っていない', () => {
    expect(allBody).not.toContain('14.75%');
  });
});

describe('記事全体の整合', () => {
  it('全記事が実在の slug を持ち、本文が空でない', () => {
    for (const a of ARTICLES) {
      expect(getArticle(a.slug)).toBeDefined();
      expect(bodyOf(a.slug).length).toBeGreaterThan(200);
    }
  });

  it('レンダラが解釈しない markdown 記法が残っていない', () => {
    expect(allBody).not.toContain('**');
  });
});
