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

describe("記事 nenkin-kurisage-tetsuzuki（D11）の繰下げ額面アンカーの二重化", () => {
  // 記事の70歳繰下げの額面（月213,000・年2,556,000）を固定（品質ゲート①）。
  // 待機・請求・66歳ルール・5年前みなし繰下げは手続き説明のため本文で扱う。
  it("70歳繰下げ 月213,000・年2,556,000（65歳15万・+42%）", () => {
    expect(monthlyPension(150_000, 70)).toBe(213_000);
    expect(pensionScenario(150_000, 70).annual).toBe(2_556_000);
  });
});

describe("記事 nenkin-kuriage-shogai-izoku（D9）の繰上げ減額アンカーの二重化", () => {
  // 記事の繰上げ減額（60歳=0.76倍・月114,000）を固定（品質ゲート①）。
  // 障害年金・寡婦年金等の権利喪失は制度説明のため本文で扱い、額面の減額を anchor にする。
  it("60歳繰上げ 月114,000（65歳15万・0.76倍）", () => {
    expect(monthlyPension(150_000, 60)).toBe(114_000);
  });
});

describe("記事 nenkin-zaishoku-kurisage（D7）の年金月額アンカーの二重化", () => {
  // 記事の年金月額（65歳15万・70歳繰下げ21.3万）を固定（品質ゲート①）。
  // 在職老齢年金の支給停止基準額（令和6年度 月50万円）は法定・年度依存で calc 未モデルのため
  // 本文で明記し、額面の年金月額を anchor にする（誤値が載ると CI が赤）。
  it("65歳月150,000・70歳繰下げ213,000（額面）", () => {
    expect(monthlyPension(150_000, 65)).toBe(150_000);
    expect(monthlyPension(150_000, 70)).toBe(213_000);
  });
});

describe("記事 nenkin-fufu-kurisage-senryaku（D8）の世帯額面の二重化", () => {
  // 記事の夫婦別 年金額面（夫月18万・妻月8万の65/70歳）を固定（品質ゲート①）。
  // 加給年金・遺族年金は法定・世帯依存で計算対象外のため本文で定性的に扱い、額面を anchor にする。
  it("夫 65歳年216万/70歳年306.72万・妻 65歳年96万/70歳年136.32万・世帯合算", () => {
    expect(pensionScenario(180_000, 65).annual).toBe(2_160_000);
    expect(pensionScenario(180_000, 70).annual).toBe(3_067_200);
    expect(pensionScenario(80_000, 65).annual).toBe(960_000);
    expect(pensionScenario(80_000, 70).annual).toBe(1_363_200);
    // 世帯合算（記事の早見）
    expect(pensionScenario(180_000, 65).annual + pensionScenario(80_000, 65).annual).toBe(3_120_000);
    expect(pensionScenario(180_000, 70).annual + pensionScenario(80_000, 65).annual).toBe(4_027_200);
    expect(pensionScenario(180_000, 65).annual + pensionScenario(80_000, 70).annual).toBe(3_523_200);
    expect(pensionScenario(180_000, 70).annual + pensionScenario(80_000, 70).annual).toBe(4_430_400);
  });
});

describe("記事 nenkin-nansai-kara-saiteki（D10）の寿命別最多開始年齢の二重化", () => {
  // 記事の寿命別 累計（最多になる開始年齢が入れ替わる）と損益分岐年齢を固定（品質ゲート①）。
  // 75/80歳没=60繰上げ最多 / 85/90歳没=70繰下げ最多 / 95/100歳没=75繰下げ最多。
  const base = 150_000;
  const maxStart = (death: number): string => {
    const arr: [string, number][] = [
      ["60", cumulativePension(base, 60, death)],
      ["65", cumulativePension(base, 65, death)],
      ["70", cumulativePension(base, 70, death)],
      ["75", cumulativePension(base, 75, death)],
    ];
    return arr.reduce((a, b) => (b[1] > a[1] ? b : a))[0];
  };
  it("寿命別に最多となる開始年齢: 75/80→60・85/90→70・95/100→75", () => {
    expect(maxStart(75)).toBe("60");
    expect(maxStart(80)).toBe("60");
    expect(maxStart(85)).toBe("70");
    expect(maxStart(90)).toBe("70");
    expect(maxStart(95)).toBe("75");
    expect(maxStart(100)).toBe("75");
  });
  it("早見表の累計値（記事の主数値）", () => {
    expect(cumulativePension(base, 60, 75)).toBe(20_520_000);
    expect(cumulativePension(base, 70, 85)).toBe(38_340_000);
    expect(cumulativePension(base, 70, 90)).toBe(51_120_000);
    expect(cumulativePension(base, 75, 95)).toBe(66_240_000);
    expect(cumulativePension(base, 75, 100)).toBe(82_800_000);
  });
  it("損益分岐年齢: 60→80歳10か月・70→81歳11か月・75→86歳11か月", () => {
    const b60 = breakEvenAgeVs65(60);
    const b70 = breakEvenAgeVs65(70);
    const b75 = breakEvenAgeVs65(75);
    expect([b60.years, b60.months]).toEqual([80, 10]);
    expect([b70.years, b70.months]).toEqual([81, 11]);
    expect([b75.years, b75.months]).toEqual([86, 11]);
  });
});

describe("記事 nenkin-kurisage-kakyu（D6）の損益分岐の二重化", () => {
  // 記事本文が参照する繰下げの損益分岐（70歳＝81歳11か月）を固定（品質ゲート①）。
  // 加給年金・振替加算の金額は法定・世帯依存で計算対象外のため本文で定性的に扱い、
  // 額面の損益分岐年齢を anchor にする（誤値が載ると CI が赤・auto-backlog §品質ゲート①）。
  it("70歳繰下げの損益分岐は81歳11か月（額面ベース）", () => {
    const b70 = breakEvenAgeVs65(70);
    expect([b70.years, b70.months]).toEqual([81, 11]);
  });
});

describe("記事 nenkin-ideco-juntai（D5）の公的年金額面の二重化", () => {
  // 記事の公的年金 額面（65/70/75歳）を固定（品質ゲート①）。iDeCo一時金の重複調整は
  // ideco ツールの領域のため本文でリンク誘導し、本記事は公的年金の額面を anchor にする。
  it("公的年金 年額 65歳1,800,000 / 70歳2,556,000 / 75歳3,312,000", () => {
    expect(pensionScenario(150_000, 65).annual).toBe(1_800_000);
    expect(pensionScenario(150_000, 70).annual).toBe(2_556_000);
    expect(pensionScenario(150_000, 75).annual).toBe(3_312_000);
  });
});

describe("記事 nenkin-kurisage-tesudori（D4）の額面の二重化", () => {
  // 記事の額面（年金額そのもの・65/70/75歳）を固定（品質ゲート①）。
  // 税・社保・手取りは公的年金等控除や自治体で変わるため本文で定量化せず、額面を anchor にする。
  it("65歳 年1,800,000 / 70歳 年2,556,000 / 75歳 年3,312,000", () => {
    expect(pensionScenario(150_000, 65).annual).toBe(1_800_000);
    expect(pensionScenario(150_000, 70).annual).toBe(2_556_000);
    expect(pensionScenario(150_000, 75).annual).toBe(3_312_000);
  });
});

describe("記事 nenkin-65-70-75-hikaku（D3）の月額・累計比較の二重化", () => {
  // 記事の月額と80/85/90歳の累計（最多が入れ替わる）を固定（品質ゲート①）。
  it("月額150k/213k/276k・80歳は65歳最多・85/90歳は70歳最多", () => {
    expect([monthlyPension(150_000, 65), monthlyPension(150_000, 70), monthlyPension(150_000, 75)]).toEqual([150_000, 213_000, 276_000]);
    expect([cumulativePension(150_000, 65, 80), cumulativePension(150_000, 70, 80), cumulativePension(150_000, 75, 80)]).toEqual([27_000_000, 25_560_000, 16_560_000]);
    expect([cumulativePension(150_000, 65, 85), cumulativePension(150_000, 70, 85), cumulativePension(150_000, 75, 85)]).toEqual([36_000_000, 38_340_000, 33_120_000]);
    expect([cumulativePension(150_000, 65, 90), cumulativePension(150_000, 70, 90), cumulativePension(150_000, 75, 90)]).toEqual([45_000_000, 51_120_000, 49_680_000]);
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
