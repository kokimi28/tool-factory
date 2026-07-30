/**
 * 年金 繰上げ・繰下げの単体テスト。受給率（繰上げ0.4%/月・繰下げ0.7%/月）と
 * 損益分岐年齢（累計が65歳受給に追いつく年齢）を実装出力で固定する。
 */
import { describe, it, expect } from "vitest";
import {
  pensionRate,
  monthlyPension,
  cumulativePension,
  breakEvenAgeVs65,
  pensionScenario,
} from "./calculations";

describe("pensionRate — 受給率（65歳=1.0）", () => {
  it("繰上げは0.4%/月減（60歳=0.76・最大−24%）", () => {
    expect(pensionRate(60)).toBeCloseTo(0.76, 10);
    expect(pensionRate(62)).toBeCloseTo(0.856, 10);
  });
  it("65歳ちょうどは1.0", () => {
    expect(pensionRate(65)).toBe(1);
  });
  it("繰下げは0.7%/月増（70歳=1.42・75歳=1.84・最大+84%）", () => {
    expect(pensionRate(66)).toBeCloseTo(1.084, 10);
    expect(pensionRate(70)).toBeCloseTo(1.42, 10);
    expect(pensionRate(75)).toBeCloseTo(1.84, 10);
  });
  it("60歳未満・75歳超は範囲内にクランプ", () => {
    expect(pensionRate(58)).toBe(pensionRate(60));
    expect(pensionRate(80)).toBe(pensionRate(75));
  });
});

describe("monthlyPension — 開始年齢別の月額（65歳15万円のとき）", () => {
  it("各年齢の月額", () => {
    expect(monthlyPension(150_000, 60)).toBe(114_000);
    expect(monthlyPension(150_000, 65)).toBe(150_000);
    expect(monthlyPension(150_000, 70)).toBe(213_000);
    expect(monthlyPension(150_000, 75)).toBe(276_000);
  });
});

describe("breakEvenAgeVs65 — 65歳受給との損益分岐年齢", () => {
  it("60歳繰上げ → 80歳10か月", () => {
    const b = breakEvenAgeVs65(60);
    expect(b.years).toBe(80);
    expect(b.months).toBe(10);
  });
  it("70歳繰下げ → 81歳11か月", () => {
    const b = breakEvenAgeVs65(70);
    expect(b.years).toBe(81);
    expect(b.months).toBe(11);
  });
  it("75歳繰下げ → 86歳11か月", () => {
    const b = breakEvenAgeVs65(75);
    expect(b.years).toBe(86);
    expect(b.months).toBe(11);
  });
  it("65歳ちょうどは分岐なし（null）", () => {
    expect(breakEvenAgeVs65(65).ageYears).toBeNull();
  });
});

describe("記事 nenkin-kuriage-demerit（D2）の繰上げ損益分岐の二重化", () => {
  // 記事の見出し数値（60歳月114,000・分岐80歳10か月・75/85歳累計）を固定（品質ゲート①）。
  it("60歳月114,000・分岐80歳10か月・75歳c60=2,052万/85歳c60=3,420万(65歳は3,600万)", () => {
    expect(monthlyPension(150_000, 60)).toBe(114_000);
    const b60 = breakEvenAgeVs65(60);
    expect([b60.years, b60.months]).toEqual([80, 10]);
    expect(cumulativePension(150_000, 60, 75)).toBe(20_520_000);
    expect(cumulativePension(150_000, 65, 75)).toBe(18_000_000);
    expect(cumulativePension(150_000, 60, 85)).toBe(34_200_000);
    expect(cumulativePension(150_000, 65, 85)).toBe(36_000_000);
  });
});

describe("記事 nenkin-kurisage-soneki（D1）の累計比較の二重化", () => {
  // 記事本文の見出し数値（85歳・90歳での累計と繰下げの差）を固定（品質ゲート①）。
  it("85歳: 65歳3,600万/70歳3,834万（差234万）・90歳: 4,500万/5,112万（差612万）", () => {
    expect(cumulativePension(150_000, 65, 85)).toBe(36_000_000);
    expect(cumulativePension(150_000, 70, 85)).toBe(38_340_000);
    expect(cumulativePension(150_000, 65, 90)).toBe(45_000_000);
    expect(cumulativePension(150_000, 70, 90)).toBe(51_120_000);
  });
});

describe("cumulativePension — 累計受給額の逆転", () => {
  it("70歳開始は82歳時点で65歳開始を上回る（分岐後）", () => {
    expect(cumulativePension(150_000, 70, 82)).toBe(30_672_000);
    expect(cumulativePension(150_000, 65, 82)).toBe(30_600_000);
    expect(cumulativePension(150_000, 70, 82)).toBeGreaterThan(
      cumulativePension(150_000, 65, 82),
    );
  });
  it("81歳時点ではまだ65歳開始が上（分岐前）", () => {
    expect(cumulativePension(150_000, 70, 81)).toBeLessThan(
      cumulativePension(150_000, 65, 81),
    );
  });
});

describe("記事 nenkin-kuriage-shikumi（D0）の worked example トレーサビリティ", () => {
  // 記事本文の見出し数値（月額60=114,000/70=213,000/75=276,000・70歳損益分岐81歳11か月）を
  // 記事 slug に紐づけて固定する（誤値が記事に載ると CI が赤・auto-backlog §品質ゲート①）。
  it("65歳月15万 → 60歳114,000/70歳213,000/75歳276,000・70歳分岐81歳11か月", () => {
    expect([
      monthlyPension(150_000, 60),
      monthlyPension(150_000, 70),
      monthlyPension(150_000, 75),
    ]).toEqual([114_000, 213_000, 276_000]);
    const b70 = breakEvenAgeVs65(70);
    expect([b70.years, b70.months]).toEqual([81, 11]);
  });
});

describe("pensionScenario — 率・月額・年額", () => {
  it("70歳開始（65歳15万）: 率1.42・月213,000・年2,556,000", () => {
    const s = pensionScenario(150_000, 70);
    expect(s.rate).toBeCloseTo(1.42, 10);
    expect(s.monthly).toBe(213_000);
    expect(s.annual).toBe(2_556_000);
  });
});
