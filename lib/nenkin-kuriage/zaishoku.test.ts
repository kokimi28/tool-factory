/**
 * 在職老齢年金の支給停止（D5）のテスト。
 *
 * いちばん強い検証は「一次資料に載っている検算例を再現できるか」なので、
 * 日本年金機構が改正ページに載せている例（改正前後の両方）をそのまま固定する。
 * https://www.nenkin.go.jp/tokusetsu/zairoukaisei.html
 */
import { describe, expect, it } from 'vitest';

import {
  SUSPENSION_THRESHOLD_SCHEDULE,
  suspensionThreshold,
  zaishokuPensionSuspension,
} from './zaishoku';
import { getArticle } from './articles';

const BEFORE = '2026-03-31'; // 令和8年3月以前
const AFTER = '2026-04-01'; // 令和8年4月以降

describe('一次資料の検算例を再現する', () => {
  // 基本月額10万円・総報酬月額相当額46万円（標準報酬月額36万＋標準賞与額120万/12）
  const input = { basicMonthly: 100_000, totalCompensationMonthly: 460_000 };

  it('改正前（51万円）: 支給7.5万円・停止2.5万円', () => {
    const r = zaishokuPensionSuspension(input, BEFORE);
    expect(r.threshold).toBe(510_000);
    expect(r.paid).toBe(75_000);
    expect(r.suspended).toBe(25_000);
  });

  it('改正後（65万円）: 合計56万円は基準額以下なので全額支給', () => {
    const r = zaishokuPensionSuspension(input, AFTER);
    expect(r.threshold).toBe(650_000);
    expect(r.combined).toBe(560_000);
    expect(r.suspended).toBe(0);
    expect(r.paid).toBe(100_000);
  });
});

describe('基準額の改定日', () => {
  it('令和8年4月の前日までは51万円、当日から65万円', () => {
    expect(suspensionThreshold(BEFORE).threshold).toBe(510_000);
    expect(suspensionThreshold(AFTER).threshold).toBe(650_000);
    expect(suspensionThreshold('2026-04-02').threshold).toBe(650_000);
  });

  it('スケジュールは施行日の昇順で、後の行ほど基準額が大きい', () => {
    for (let i = 1; i < SUSPENSION_THRESHOLD_SCHEDULE.length; i += 1) {
      expect(SUSPENSION_THRESHOLD_SCHEDULE[i]!.from > SUSPENSION_THRESHOLD_SCHEDULE[i - 1]!.from).toBe(true);
    }
  });
});

describe('計算式（超過分の半分だけ止まる）', () => {
  it('基準額ちょうどでは止まらない（以下は全額支給）', () => {
    const r = zaishokuPensionSuspension(
      { basicMonthly: 150_000, totalCompensationMonthly: 500_000 },
      AFTER,
    );
    expect(r.combined).toBe(650_000);
    expect(r.suspended).toBe(0);
  });

  it('基準額を1円でも超えれば超過分の半分が止まる', () => {
    const r = zaishokuPensionSuspension(
      { basicMonthly: 150_000, totalCompensationMonthly: 500_002 },
      AFTER,
    );
    expect(r.combined).toBe(650_002);
    expect(r.suspended).toBe(1);
    expect(r.paid).toBe(149_999);
  });

  it('超過分の半分が基本月額を超えても、止まるのは基本月額まで（全部停止）', () => {
    const r = zaishokuPensionSuspension(
      { basicMonthly: 100_000, totalCompensationMonthly: 2_000_000 },
      AFTER,
    );
    expect(r.suspended).toBe(100_000);
    expect(r.paid).toBe(0);
    expect(r.fullySuspended).toBe(true);
  });

  it('賃金がゼロなら止まらない', () => {
    const r = zaishokuPensionSuspension(
      { basicMonthly: 150_000, totalCompensationMonthly: 0 },
      AFTER,
    );
    expect(r.suspended).toBe(0);
    expect(r.paid).toBe(150_000);
    expect(r.fullySuspended).toBe(false);
  });
});

describe('異常入力', () => {
  it('負・NaN・Infinity は0として扱う', () => {
    for (const bad of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
      const r = zaishokuPensionSuspension(
        { basicMonthly: bad, totalCompensationMonthly: bad },
        AFTER,
      );
      expect(r.suspended).toBe(0);
      expect(r.paid).toBe(0);
      expect(r.fullySuspended).toBe(false);
    }
  });
});

describe('改正の効果（記事が主張する向き）', () => {
  it('同じ条件なら改正後のほうが停止額は小さいか同じ（基準額が上がったので）', () => {
    for (const comp of [400_000, 500_000, 600_000, 800_000]) {
      const before = zaishokuPensionSuspension({ basicMonthly: 150_000, totalCompensationMonthly: comp }, BEFORE);
      const after = zaishokuPensionSuspension({ basicMonthly: 150_000, totalCompensationMonthly: comp }, AFTER);
      expect(after.suspended).toBeLessThanOrEqual(before.suspended);
    }
  });
});

describe('記事 nenkin-zaishoku-kurisage の数値が実装と一致している', () => {
  const body = (() => {
    const a = getArticle('nenkin-zaishoku-kurisage');
    if (!a) throw new Error('article not found');
    return [
      a.title,
      a.description,
      a.lead,
      ...a.sections.flatMap((s) => [s.heading ?? '', ...s.paragraphs, ...(s.bullets ?? [])]),
      ...(a.faqs ?? []).flatMap((f) => [f.question, f.answer]),
    ].join('\n');
  })();

  /** 650_000 -> "65" */
  const man = (yen: number): string => String(yen / 10_000);
  const now = suspensionThreshold('2026-08-17');
  const prev = suspensionThreshold('2026-03-31');

  it('現行の基準額を、年度ラベルと対で載せている', () => {
    expect(body).toContain(`基準額（支給停止調整額）は${now.label}で月${man(now.threshold)}万円です`);
    expect(body).toContain(`${now.label}は月${man(now.threshold)}万円`);
  });

  it('改正前の基準額と引き上げを正しく載せている', () => {
    expect(body).toContain(`${man(prev.threshold)}万円から${man(now.threshold)}万円へ引き上げられました`);
  });

  it('計算例が実装と一致する（年金・給与・停止額・受取額を対で）', () => {
    const r = zaishokuPensionSuspension(
      { basicMonthly: 150_000, totalCompensationMonthly: 550_000 },
      '2026-08-17',
    );
    // 記事は「年金15万＋給与55万＝70万 → 超過5万の半分＝2.5万停止 → 受取12.5万」と書く
    expect(r.combined).toBe(700_000);
    expect(r.suspended).toBe(25_000);
    expect(r.paid).toBe(125_000);
    expect(body).toContain(
      `給与月額換算${man(550_000)}万円で働くと、合計${man(r.combined)}万円。基準額${man(r.threshold)}万円を${man(r.combined - r.threshold)}万円超えるため、超過分の半分＝月${man(r.suspended)}万円が支給停止され、実際に受け取れるのは月12.5万円になります`,
    );
    expect(body).toContain(`例: 年金15万＋給与55万＝${man(r.combined)}万 → 超過5万の半分＝2.5万円/月が停止`);
  });

  it('「基準額未満に抑える」助言が現行の基準額を指している', () => {
    expect(body).toContain(`給与を基準額（月${man(now.threshold)}万円）未満に調整して`);
  });

  it('旧基準額を現行として載せていない', () => {
    // 令和6年度 月50万円 は2世代前の値。残っていたら誤り。
    expect(body).not.toContain('令和6年度');
    expect(body).not.toContain('月50万円');
  });
});
