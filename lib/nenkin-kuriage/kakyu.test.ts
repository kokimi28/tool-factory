/**
 * 加給年金額と振替加算（D6）のテスト。
 *
 * 表は一次資料の公示額をそのまま持っているので、テストの役目は
 * ①表そのものの内部整合（公示額が率と単価から再現できるか）
 * ②帯の境界（生年月日の1日違いで金額が変わる境目）
 * ③記事の数値が実装と一致しているか
 * の3点。
 *
 * ②が重要な理由: この表はすべて「◯年4月2日から△年4月1日」で区切られており、
 * 4月1日と4月2日で別の帯に入る。off-by-one を作りやすい形をしている。
 */
import { describe, expect, it } from 'vitest';

import { getArticle } from './articles';
import {
  BASIC_PENSION_UNIT,
  FURIKAE_TABLE,
  KAKYU_AMOUNT,
  SPECIAL_ADDITION_TABLE,
  furikaeKasan,
  kakyuPension,
  spouseSpecialAddition,
} from './kakyu';

const yen = (n: number): string => n.toLocaleString('en-US');

describe('表の内部整合（公示額が再現できる）', () => {
  it('特別加算の「合計額」は 配偶者243,800円 ＋ 特別加算 になっている', () => {
    // 一次資料の合計額: 279,800 / 315,700 / 351,800 / 387,700 / 423,700
    const published = [279_800, 315_700, 351_800, 387_700, 423_700];
    expect(SPECIAL_ADDITION_TABLE).toHaveLength(5);
    SPECIAL_ADDITION_TABLE.forEach((row, i) => {
      expect(KAKYU_AMOUNT.spouse + row.extra).toBe(published[i]);
    });
  });

  it('振替加算の年額は「単価 × 政令率」で再現できる（単価は生年月日で2段階）', () => {
    // 令和8年度は老齢基礎年金の単価が2段階。単一の単価で検算すると10行ずれる
    // ＝この2段階を知らずに率から計算し直すと誤る、という記録でもある。
    expect(FURIKAE_TABLE).toHaveLength(40);
    const BOUNDARY = '1956-04-02'; // 昭和31年4月2日
    for (const row of FURIKAE_TABLE) {
      const late = row.bornFrom !== null && row.bornFrom >= BOUNDARY;
      const unit = late
        ? BASIC_PENSION_UNIT.bornOnAfter1956_04_02
        : BASIC_PENSION_UNIT.bornBefore1956_04_02;
      expect(Math.abs(Math.round(unit * row.rate) - row.annual)).toBeLessThanOrEqual(1);
    }
  });

  it('単一の単価では再現できない行が実際に存在する（2段階が必要な証拠）', () => {
    const single = BASIC_PENSION_UNIT.bornBefore1956_04_02;
    const mismatches = FURIKAE_TABLE.filter(
      (r) => Math.abs(Math.round(single * r.rate) - r.annual) > 1,
    );
    expect(mismatches.length).toBeGreaterThan(0);
  });

  it('振替加算は生年が若くなるほど減る（率が単調非増加）', () => {
    for (let i = 1; i < FURIKAE_TABLE.length; i += 1) {
      expect(FURIKAE_TABLE[i]!.rate).toBeLessThanOrEqual(FURIKAE_TABLE[i - 1]!.rate);
    }
  });

  it('帯に隙間や重複が無い（前の行の終わりの翌日が次の行の始まり）', () => {
    const nextDay = (iso: string): string => {
      const d = new Date(`${iso}T00:00:00Z`);
      d.setUTCDate(d.getUTCDate() + 1);
      return d.toISOString().slice(0, 10);
    };
    for (const table of [SPECIAL_ADDITION_TABLE, FURIKAE_TABLE]) {
      for (let i = 1; i < table.length; i += 1) {
        const prevTo = table[i - 1]!.bornTo;
        const thisFrom = table[i]!.bornFrom;
        expect(prevTo).not.toBeNull();
        expect(thisFrom).toBe(nextDay(prevTo!));
      }
    }
  });
});

describe('帯の境界（4月1日と4月2日で変わる）', () => {
  it('特別加算: 昭和18年4月1日生まれは143,900円、4月2日生まれは179,900円', () => {
    expect(spouseSpecialAddition('1943-04-01')).toBe(143_900);
    expect(spouseSpecialAddition('1943-04-02')).toBe(179_900);
  });

  it('特別加算: 表より前（昭和9年4月1日以前）は0', () => {
    expect(spouseSpecialAddition('1934-04-01')).toBe(0);
    expect(spouseSpecialAddition('1934-04-02')).toBe(36_000);
  });

  it('振替加算: 昭和41年4月1日生まれは16,335円、4月2日生まれは対象外で0', () => {
    expect(furikaeKasan('1966-04-01')).toBe(16_335);
    expect(furikaeKasan('1966-04-02')).toBe(0);
  });

  it('振替加算: 最年長帯は満額243,100円', () => {
    expect(furikaeKasan('1927-04-01')).toBe(243_100);
    expect(furikaeKasan('1900-01-01')).toBe(243_100);
  });

  it('振替加算: 老齢基礎年金の単価が切り替わる境界（昭和31年4月1日/2日）', () => {
    // 昭和30年4月2日〜昭和31年4月1日 は旧単価、昭和31年4月2日〜 は新単価
    expect(furikaeKasan('1956-04-01')).toBeGreaterThan(0);
    expect(furikaeKasan('1956-04-02')).toBeGreaterThan(0);
    expect(furikaeKasan('1956-04-01')).not.toBe(furikaeKasan('1956-04-02'));
  });
});

describe('加給年金の合計', () => {
  const BORN = '1950-01-01'; // 昭和18年4月2日以後 → 特別加算179,900円

  it('配偶者のみ: 243,800 ＋ 179,900 ＝ 423,700円', () => {
    const r = kakyuPension({ hasEligibleSpouse: true, eligibleChildCount: 0, recipientBirthDate: BORN });
    expect(r.spouseSpecialAddition).toBe(179_900);
    expect(r.spouseTotal).toBe(423_700);
    expect(r.total).toBe(423_700);
  });

  it('配偶者なし・子なしは0（特別加算も付かない）', () => {
    const r = kakyuPension({ hasEligibleSpouse: false, eligibleChildCount: 0, recipientBirthDate: BORN });
    expect(r.total).toBe(0);
    expect(r.spouseSpecialAddition).toBe(0);
  });

  it('子は1人目・2人目が各243,800円、3人目以降が各81,300円', () => {
    const of = (n: number) =>
      kakyuPension({ hasEligibleSpouse: false, eligibleChildCount: n, recipientBirthDate: BORN }).childrenTotal;
    expect(of(1)).toBe(243_800);
    expect(of(2)).toBe(487_600);
    expect(of(3)).toBe(568_900);
    expect(of(4)).toBe(650_200);
  });

  it('配偶者＋子2人の合計', () => {
    const r = kakyuPension({ hasEligibleSpouse: true, eligibleChildCount: 2, recipientBirthDate: BORN });
    expect(r.total).toBe(423_700 + 487_600);
  });

  it('子の人数は負・小数・NaN を安全に扱う', () => {
    const of = (n: number) =>
      kakyuPension({ hasEligibleSpouse: false, eligibleChildCount: n, recipientBirthDate: BORN }).childrenTotal;
    expect(of(-1)).toBe(0);
    expect(of(Number.NaN)).toBe(0);
    expect(of(2.9)).toBe(487_600);
  });

  it('特別加算は受給権者本人の生年月日で決まる（配偶者のではない）', () => {
    const older = kakyuPension({ hasEligibleSpouse: true, eligibleChildCount: 0, recipientBirthDate: '1940-06-01' });
    const younger = kakyuPension({ hasEligibleSpouse: true, eligibleChildCount: 0, recipientBirthDate: '1950-06-01' });
    expect(older.spouseSpecialAddition).toBe(71_900);
    expect(younger.spouseSpecialAddition).toBe(179_900);
  });
});

describe('記事 nenkin-kurisage-kakyu の数値が実装と一致している', () => {
  const body = (() => {
    const a = getArticle('nenkin-kurisage-kakyu');
    if (!a) throw new Error('article not found');
    return [
      a.title,
      a.description,
      a.lead,
      ...a.sections.flatMap((s) => [s.heading ?? '', ...s.paragraphs, ...(s.bullets ?? [])]),
      ...(a.faqs ?? []).flatMap((f) => [f.question, f.answer]),
    ].join('\n');
  })();

  const spouseWithMaxAddition =
    KAKYU_AMOUNT.spouse + SPECIAL_ADDITION_TABLE[SPECIAL_ADDITION_TABLE.length - 1]!.extra;

  it('配偶者の加給年金額を、基本額と特別加算の内訳つきで載せている', () => {
    expect(body).toContain(
      `配偶者${yen(KAKYU_AMOUNT.spouse)}円に特別加算${yen(SPECIAL_ADDITION_TABLE[SPECIAL_ADDITION_TABLE.length - 1]!.extra)}円を加えた年${yen(spouseWithMaxAddition)}円`,
    );
  });

  it('子の加算額を正しく載せている', () => {
    expect(body).toContain(
      `1人目・2人目の子は各${yen(KAKYU_AMOUNT.childFirstSecond)}円、3人目以降は各${yen(KAKYU_AMOUNT.childThirdOnward)}円`,
    );
  });

  it('振替加算の上限額と対象の下限を載せている', () => {
    expect(body).toContain(`最も多い場合で年${yen(FURIKAE_TABLE[0]!.annual)}円`);
    expect(body).toContain('昭和41年4月2日以後に生まれた方は対象外');
  });

  it('「年約40万円」のような丸めた表現を残していない', () => {
    // 実額 423,700円 が出せるようになったので、曖昧な概算表現は使わない
    expect(body).not.toContain('年約40万円');
  });

  it('レンダラが解釈しない markdown 記法が残っていない', () => {
    expect(body).not.toContain('**');
  });
});
