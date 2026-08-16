/**
 * nenshu-kabe の記事本文ロック。
 *
 * なぜ必要か: tedori 側には prose lock（記事の数値を production の出力から導出して固定）が
 * あるが、nenshu-kabe には無かった。そのため「回復ライン」の結論が実装と食い違ったまま
 * 全テスト green で公開される事故が実際に起きた —
 * `analyzeWallReversal(1_060_000).recoveryIncome` は 1,240,000（124万）を返すのに、
 * nenshu-kabe-hatarakikata の description / bullet / 見出し / 本文 / FAQ の 5 箇所が
 * 「約125万円（1,066,062円）から」と書いており、同リポの他 10 箇所（124万）とも矛盾していた。
 * 1,066,062 は 125万円の手取りとしては正しい数値なので、数値単体の照合では捕まらない。
 * 「結論の年収」と「その年収の手取り」を **対で** production から導出して照合する。
 *
 * 規約: 期待値はすべて production 関数から導出する（記事からコピーしない）。
 * 記事からコピーした文字列を assert しても何も証明しないため。
 */
import { describe, expect, it } from 'vitest';

import { ARTICLES, getArticle } from './articles';
import { analyzeWallReversal, takeHomeAtIncome } from './calculations';

/** 12,345 -> "12,345" */
const yen = (n: number): string => n.toLocaleString('en-US');
/** 1_240_000 -> "124" (万円表記の整数部) */
const man = (n: number): string => String(n / 10_000);

const bodyOf = (slug: string): string => {
  const a = getArticle(slug);
  if (!a) throw new Error(`article not found: ${slug}`);
  return [
    a.title,
    a.description,
    a.lead,
    ...a.sections.flatMap((s) => [s.heading, ...s.paragraphs, ...(s.bullets ?? [])]),
    ...a.faqs.flatMap((f) => [f.question, f.answer]),
  ].join('\n');
};

describe('106万の壁 回復ラインの結論が実装と一致している', () => {
  const KEEP_UNDER = 1_060_000; // 「抑える」側の年収
  const reversal = analyzeWallReversal(KEEP_UNDER);
  const recovery = reversal.recoveryIncome;
  const recoveryTakeHome = takeHomeAtIncome(recovery, true).takeHome;

  it('回復年収は実装が返す値であって、隣接する年収ではない', () => {
    // 125万（1,066,062円）は「105万を上回る年収」ではあるが最小ではない。
    // 結論として載せてよいのは実装が返す最小値だけ。
    expect(recovery).toBe(1_240_000);
    expect(recoveryTakeHome).toBeGreaterThanOrEqual(1_050_000);
    expect(takeHomeAtIncome(recovery - 10_000, true).takeHome).toBeLessThan(1_050_000);
  });

  it('記事は「回復年収」と「その手取り」を対で正しく載せている', () => {
    const body = bodyOf('nenshu-kabe-hatarakikata');
    // 年収と手取りが同じ文の中で対になっていることを確認する
    expect(body).toContain(`約${man(recovery)}万円（${yen(recoveryTakeHome)}円）`);
    expect(body).toContain(`約${man(recovery)}万円（手取り${yen(recoveryTakeHome)}円）`);
    expect(body).toContain(`年収${man(recovery)}万円: 手取り ${yen(recoveryTakeHome)}円`);
  });

  it('働き損ゾーンの上端が回復年収と一致している', () => {
    const body = bodyOf('nenshu-kabe-hatarakikata');
    expect(body).toContain(`106万〜${man(recovery)}万円`);
  });

  it('回復年収より小さい年収を結論として載せていない', () => {
    // 「約125万円から」のような、実装より大きい（＝働き損ゾーンを過大に見せる）結論を禁止する
    const body = bodyOf('nenshu-kabe-hatarakikata');
    for (const wrong of [1_250_000, 1_230_000, 1_200_000]) {
      expect(body).not.toContain(`約${man(wrong)}万円（${yen(takeHomeAtIncome(wrong, true).takeHome)}円）`);
      expect(body).not.toContain(`106万〜${man(wrong)}万円`);
    }
  });
});

describe('税額の内訳ラベルが実装と一致している（所得税と住民税を取り違えない）', () => {
  it('年収110万円で発生するのは住民税であって所得税ではない', () => {
    const r = takeHomeAtIncome(1_100_000, false);
    // 令和7年改正の控除により、この年収では所得税は発生しない
    expect(r.incomeTax).toBe(0);
    expect(r.residentTax).toBe(7_000);

    const body = bodyOf('nenshu-kabe-103');
    expect(body).toContain(`住民税約${yen(r.residentTax)}円`);
    // 「所得税は約7,000円」という誤ラベルを禁止する
    expect(body).not.toContain(`所得税は約${yen(r.residentTax)}円`);
  });
});

describe('記事全体の整合', () => {
  it('全記事が実在の slug を持ち、本文が空でない', () => {
    for (const a of ARTICLES) {
      expect(getArticle(a.slug)).toBeDefined();
      expect(bodyOf(a.slug).length).toBeGreaterThan(200);
    }
  });
});
