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
import {
  calcFurusatoLimit,
  deductionTaxSaving,
  deductionTradeoff,
  estimateFurusatoLimitFromSalary,
} from './calculations';

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

describe('記事 furusato-ideco-iryohi のトレードオフが実装と一致している（G4）', () => {
  const article = getArticle('furusato-ideco-iryohi')!;
  const units = [
    article.title, article.description, article.lead,
    ...article.sections.flatMap((s) => [s.heading ?? '', ...s.paragraphs, ...(s.bullets ?? [])]),
    ...(article.faqs ?? []).map((f) => `${f.question}\n${f.answer}`),
  ];
  const body = units.join('\n');
  const yen = (n: number): string => n.toLocaleString('en-US');
  const ideco = deductionTradeoff(3_000_000, 276_000);
  const medical = deductionTradeoff(3_000_000, 300_000);
  const lowIncome = deductionTradeoff(2_000_000, 276_000);

  it('iDeCo の3点（目減り・節税・差引）を実額で載せている', () => {
    expect(body).toContain(
      `ふるさと納税の限度額は${yen(ideco.limitDecrease)}円下がります`,
    );
    expect(body).toContain(`節税は${yen(ideco.taxSaving)}円`);
    expect(body).toContain(`差引で${yen(ideco.netGain)}円のプラス`);
  });

  it('節税の内訳（所得税・住民税）が実装と一致する', () => {
    const s = deductionTaxSaving(276_000, 3_000_000);
    expect(body).toContain(`（所得税${yen(s.incomeTax)}円＋住民税${yen(s.residentTax)}円）`);
  });

  it('医療費控除の例も実額で載せている', () => {
    expect(body).toContain(
      `限度額は${yen(medical.limitDecrease)}円下がる一方、節税は${yen(medical.taxSaving)}円。差引${yen(medical.netGain)}円のプラス`,
    );
  });

  it('倍率を載せていて、実装が出す倍率と一致する', () => {
    expect(body).toContain(`約${ideco.ratio.toFixed(1)}倍`);
    expect(body).toContain(`約${lowIncome.ratio.toFixed(1)}倍`);
  });

  it('所得が低いほど倍率が下がるが結論は変わらない、と書いている', () => {
    expect(lowIncome.ratio).toBeLessThan(ideco.ratio); // 前提が崩れたら本文も直す
    expect(lowIncome.netGain).toBeGreaterThan(0);
    expect(body).toContain('所得が低いほど倍率は下がるが、結論は変わらない');
  });

  it('本文に出るすべての「◯倍」が実装が出す倍率と一致する', () => {
    // 倍率は本文と FAQ の2箇所に出る。片方だけ直して片方が古いまま、を防ぐため
    // toContain ではなく全出現を集合で照合する（KAIZEN 2026-08-18 の既定形）。
    const allowed = new Set(
      [ideco, medical, lowIncome, deductionTradeoff(5_000_000, 276_000)].map(
        (t) => `約${t.ratio.toFixed(1)}倍`,
      ),
    );
    const found = [...body.matchAll(/約\d+(?:\.\d+)?倍/g)].map((m) => m[0]!);
    expect(found.length).toBeGreaterThanOrEqual(2);
    for (const f of found) expect([...allowed]).toContain(f);
  });

  it('本文に出るトレードオフの金額がすべて実装の値と一致する', () => {
    const allowed = new Set<string>();
    for (const t of [ideco, medical, lowIncome]) {
      for (const v of [t.deduction, t.limitBefore, t.limitAfter, t.limitDecrease, t.taxSaving, t.netGain]) {
        allowed.add(yen(v));
      }
      const sv = deductionTaxSaving(t.deduction, 3_000_000);
      allowed.add(yen(sv.incomeTax));
      allowed.add(yen(sv.residentTax));
    }
    // 低所得の例だけ限界税率が違うので、その内訳も許容集合に入れる
    const svLow = deductionTaxSaving(lowIncome.deduction, 2_000_000);
    allowed.add(yen(svLow.incomeTax));
    allowed.add(yen(svLow.residentTax));
    // 「◯円下がります」「節税は◯円」「差引◯円」に現れる4桁以上の金額だけを対象にする
    const found = [...body.matchAll(/\d{1,3}(?:,\d{3})+(?=円)/g)].map((m) => m[0]!);
    expect(found.length).toBeGreaterThanOrEqual(8);
    for (const f of found) expect([...allowed]).toContain(f);
  });

  it('定量化を避けた古い言い回しが残っていない', () => {
    expect(body).not.toContain('通常は大きく');
  });
});
