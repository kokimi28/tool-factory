/**
 * E14 賞与（ボーナス）の手取り計算テスト。
 *
 * 賞与は給与と算定の土台が違う（標準賞与額・別の上限・別の源泉徴収表・住民税なし）。
 * その差分を worked example と境界値で固定する（§品質ゲート①：誤値は CI で赤）。
 * 特に次の4点は誤りやすいので独立した describe で押さえる:
 *  ① 源泉徴収税率の行境界（令和8年分・扶養0人の20本すべて・以上/未満の向き）
 *  ② 上限（健保は年度累計573万円・厚年は月150万円でリセット）
 *  ③ 端数処理（50銭以下切捨＝Math.round では1円ずれる）
 *  ④ 丸めの単位（健保＋介護＋支援金は健保法156条1項1号の1本の保険料額。個別に丸めない）
 */
import { describe, it, expect } from "vitest";
import {
  calculateBonusNetPay,
  bonusSocialInsurance,
  bonusWithholdingRate,
  requiresMonthlyTableMethod,
  type BonusNetPayInput,
} from "./bonus";
import { calculateNetSalary } from "./calculations";
import { BONUS_CAP, RATE_EMP_P100K } from "./rates";
import { getAllArticles } from "./articles";

const calc = (input: Partial<BonusNetPayInput> & { bonusAmount: number }) =>
  calculateBonusNetPay({ previousMonthSalary: 300_000, isOver40: false, ...input });

describe("E14 源泉徴収税率の表（令和8年分・甲欄・扶養親族等の数0人）", () => {
  // [境界額, その1円下の率, 境界額での率]。「以上」は含み「未満」は含まない（国税庁）。
  const boundaries: Array<[number, number, number]> = [
    [82_000, 0, 2.042],
    [94_000, 2.042, 4.084],
    [260_000, 4.084, 6.126],
    [309_000, 6.126, 8.168],
    [342_000, 8.168, 10.21],
    [372_000, 10.21, 12.252],
    [402_000, 12.252, 14.294],
    [433_000, 14.294, 16.336],
    [520_000, 16.336, 18.378],
    [605_000, 18.378, 20.42],
    [684_000, 20.42, 22.462],
    [715_000, 22.462, 24.504],
    [752_000, 24.504, 26.546],
    [795_000, 26.546, 28.588],
    [854_000, 28.588, 30.63],
    [922_000, 30.63, 32.672],
    [1_318_000, 32.672, 35.735],
    [1_521_000, 35.735, 38.798],
    [2_621_000, 38.798, 41.861],
    [3_495_000, 41.861, 45.945],
  ];

  for (const [bound, below, at] of boundaries) {
    it(`前月${bound.toLocaleString()}円の境界: ${below}% → ${at}%`, () => {
      expect(bonusWithholdingRate(bound - 1)).toBe(below); // 未満はその額を含まない
      expect(bonusWithholdingRate(bound)).toBe(at); // 以上はその額を含む
      expect(bonusWithholdingRate(bound + 1)).toBe(at);
    });
  }

  it("最下段は0%・最上段は45.945%で頭打ち", () => {
    expect(bonusWithholdingRate(0)).toBe(0);
    expect(bonusWithholdingRate(81_999)).toBe(0);
    expect(bonusWithholdingRate(10_000_000)).toBe(45.945);
  });

  it("率は復興特別所得税込み（基準税率×1.021 に一致する）", () => {
    // 2.042=2×1.021 / 32.672=32×1.021 / 45.945=45×1.021。二重に1.021を掛けていない。
    expect(bonusWithholdingRate(82_000)).toBeCloseTo(2 * 1.021, 10);
    expect(bonusWithholdingRate(922_000)).toBeCloseTo(32 * 1.021, 10);
    expect(bonusWithholdingRate(3_495_000)).toBeCloseTo(45 * 1.021, 10);
  });

  it("扶養親族等の数が1人以上は未実装のため例外", () => {
    expect(() => bonusWithholdingRate(300_000, 1)).toThrow(/扶養親族等の数は0人のみ/);
    expect(() => calc({ bonusAmount: 500_000, dependents: 2 })).toThrow(/扶養親族等の数は0人のみ/);
  });

  it("国税庁の計算例の税額を再現する（1円未満切捨）", () => {
    // 賞与(社保控除後)468,407円 × 2.042% = 9,564円（zeigakuhyo2026/19-22.pdf ⑷②）
    expect(Math.floor((468_407 * 2_042) / 100_000)).toBe(9_564);
    // 389,558円 × 2.042% = 7,954円（タックスアンサー No.2523）
    expect(Math.floor((389_558 * 2_042) / 100_000)).toBe(7_954);
  });
});

describe("E14 標準賞与額と上限", () => {
  it("標準賞与額は1,000円未満切捨", () => {
    expect(bonusSocialInsurance(456_789, false).standardBonus).toBe(456_000);
    expect(bonusSocialInsurance(999, false).standardBonus).toBe(0);
    expect(bonusSocialInsurance(500_000, false).standardBonus).toBe(500_000);
  });

  it("厚年の月150万円上限: 未満はそのまま・ちょうどは全額・超過分は切る", () => {
    expect(bonusSocialInsurance(1_499_000, false).standardBonusPension).toBe(1_499_000);
    expect(bonusSocialInsurance(1_500_000, false).standardBonusPension).toBe(1_500_000);
    expect(bonusSocialInsurance(1_501_000, false).standardBonusPension).toBe(1_500_000);
    expect(bonusSocialInsurance(3_000_000, false).standardBonusPension).toBe(1_500_000);
    // 保険料も上限で頭打ち（150万×9.15%＝137,250円）
    expect(bonusSocialInsurance(1_500_000, false).pension).toBe(137_250);
    expect(bonusSocialInsurance(3_000_000, false).pension).toBe(137_250);
  });

  it("厚年の上限は月ごと・健保と違って年度累計しない", () => {
    // 年度累計を渡しても厚年の算定基礎は変わらない
    const a = bonusSocialInsurance(1_000_000, false, 0);
    const b = bonusSocialInsurance(1_000_000, false, 5_000_000);
    expect(a.standardBonusPension).toBe(1_000_000);
    expect(b.standardBonusPension).toBe(1_000_000);
    expect(a.pension).toBe(b.pension);
  });

  it("健保の年度累計573万円上限: 未達・ちょうど・超過", () => {
    // 累計542.9万＋30万＝572.9万（未達）→ 全額が対象
    expect(bonusSocialInsurance(300_000, false, 5_429_000).standardBonusHealth).toBe(300_000);
    // 累計543万＋30万＝573万（ちょうど）→ 全額が対象
    expect(bonusSocialInsurance(300_000, false, 5_430_000).standardBonusHealth).toBe(300_000);
    // 超える月は「累計が573万になるまで」の差分だけが対象
    expect(bonusSocialInsurance(301_000, false, 5_430_000).standardBonusHealth).toBe(300_000);
    // 到達後の月は0（健保法45条1項ただし書）
    expect(bonusSocialInsurance(300_000, false, 5_730_000).standardBonusHealth).toBe(0);
    expect(bonusSocialInsurance(300_000, false, 6_000_000).standardBonusHealth).toBe(0);
  });

  it("573万円到達後は健保・介護・支援金が0になり、厚年と雇用保険だけ残る", () => {
    const r = calc({ bonusAmount: 300_000, fiscalYearHealthBonusTotal: 5_730_000 });
    expect(r.healthInsurance).toBe(0);
    expect(r.childCareSupportLevy).toBe(0);
    expect(calc({ bonusAmount: 300_000, isOver40: true, fiscalYearHealthBonusTotal: 5_730_000 })
      .nursingInsurance).toBe(0);
    expect(r.pensionInsurance).toBe(27_450); // 厚年は上限と無関係に課される
    expect(r.employmentInsurance).toBe(1_500);
    expect(r.socialInsurance).toBe(28_950);
  });

  it("573万円到達後も所得税は引かれる（28,950円は社会保険料であって控除合計ではない）", () => {
    // 記事 shoyo-tedori ②が「引かれるのは…28,950円だけ」と書いて所得税を落としていた箇所。
    // 社会保険料が減ると課税対象（賞与−社会保険料）が増えるため、所得税はむしろ上がる。
    const r = calc({ bonusAmount: 300_000, fiscalYearHealthBonusTotal: 5_730_000 });
    expect(r.socialInsurance).toBe(28_950);
    expect(r.withholdingRate).toBe(6.126); // 前月給与300,000円の行
    expect(r.incomeTax).toBe(16_604); // (300,000−28,950)×6.126% ＝ 16,604.52 → 切捨
    expect(r.totalDeduction).toBe(45_554); // ＝ 28,950 + 16,604（≠ 28,950）
    expect(r.takeHome).toBe(254_446); // 271,050 ではない
    expect(Math.round(r.takeHomeRate * 1000) / 10).toBe(84.8);
    // 上限未到達（累計0）のときより社会保険料は小さいが所得税は大きい
    const base = calc({ bonusAmount: 300_000 });
    expect(r.socialInsurance).toBeLessThan(base.socialInsurance);
    expect(r.incomeTax).toBeGreaterThan(base.incomeTax);
  });

  it("年度累計は戻り値で繰り越せる（複数回の賞与を連結できる）", () => {
    const first = calc({ bonusAmount: 3_000_000 });
    expect(first.fiscalYearHealthBonusTotalAfter).toBe(3_000_000);
    const second = calc({
      bonusAmount: 3_000_000,
      fiscalYearHealthBonusTotal: first.fiscalYearHealthBonusTotalAfter,
    });
    // 2回目は 573万−300万＝273万 までしか健保の対象にならない
    expect(second.standardBonusHealth).toBe(2_730_000);
    expect(second.fiscalYearHealthBonusTotalAfter).toBe(5_730_000);
  });

  it("雇用保険は上限も標準賞与額もなく、賞与の実額に料率を掛ける", () => {
    // 標準賞与額は300,000円だが、雇用保険は300,100円が基礎（徴収法11条1項・上限規定なし）
    expect(bonusSocialInsurance(300_100, false).standardBonus).toBe(300_000);
    expect(bonusSocialInsurance(300_100, false).employment).toBe(1_500); // 1,500.5→切捨
    // 150万を超えても頭打ちにならない
    expect(bonusSocialInsurance(3_000_000, false).employment).toBe(15_000);
  });
});

describe("E14 端数処理（50銭以下切捨・Math.round では1円ずれる）", () => {
  // 丸めが働く単位は「法定の保険料額」ごとに1回。健保＋介護＋支援金は健保法156条1項1号で
  // 1本の保険料額なので合算率で1回、厚年・雇用保険は算定基礎が別なのでそれぞれ1回。
  it("ちょうど50銭は切り捨てる", () => {
    const r = bonusSocialInsurance(10_000, false);
    // 健保＋支援金の合算 10,000×(9.90%+0.23%)÷2＝506.50 → 506（Math.round なら507）
    expect(r.healthGroupTotal).toBe(506);
    expect(r.pension).toBe(915); // 10,000×9.15%＝915.00（端数なし）
    expect(r.employment).toBe(50); // 端数なし
    expect(r.total).toBe(1_471);
    // 40歳以上は介護を足した 10,000×11.75%÷2＝587.50 → 587
    expect(bonusSocialInsurance(10_000, true).healthGroupTotal).toBe(587);
  });

  it("厚年の50銭ちょうども切り捨てる（合算されない独立の保険料額）", () => {
    const r = bonusSocialInsurance(1_000, false);
    expect(r.pension).toBe(91); // 1,000×9.15%＝91.50 → 91（Math.round なら92）
    expect(r.employment).toBe(5); // 1,000×0.5%＝5.00
    // 健保＋支援金は 1,000×10.13%÷2＝50.65 → 51（健保49.50・支援金1.15 を個別に丸めると50で誤り）
    expect(r.healthGroupTotal).toBe(51);
    expect(r.total).toBe(147);
  });

  it("50銭を超える端数は切り上げる", () => {
    // 1,499,000×10.13%÷2＝75,924.35 → 75,924（切捨側）／内訳は支援金が1,723.85→1,724
    expect(bonusSocialInsurance(1_499_000, false).childCare).toBe(1_724);
    // 1,501,000×10.13%÷2＝76,025.65 → 76,026（切上側）
    expect(bonusSocialInsurance(1_501_000, false).healthGroupTotal).toBe(76_026);
    // 1,500,999円の雇用保険 0.5%＝7,504.995 → 7,505
    expect(bonusSocialInsurance(1_500_999, false).employment).toBe(7_505);
  });

  it("大きい額でも50銭ちょうどは切捨のまま", () => {
    // 1,499,000×10.13%÷2＝75,924.35 → 75,924 ／ 厚年 ×9.15%＝137,158.50 → 137,158
    const r = bonusSocialInsurance(1_499_000, false);
    expect(r.healthGroupTotal).toBe(75_924);
    expect(r.health).toBe(74_200); // 厳密74,200.50・按分は支援金側（端数0.85）が優先
    expect(r.pension).toBe(137_158);
    // 1,501,000 は合算76,025.65 → 76,026 で切り上がるため、按分で健保が74,300になる
    // （健保だけを個別に丸めた74,299は法定額の分解として1円不足する）
    expect(bonusSocialInsurance(1_501_000, false).health).toBe(74_300);
  });

  it("介護保険料は40〜64歳のみ（1.62%の折半＝0.81%）", () => {
    expect(bonusSocialInsurance(1_000_000, false).nursing).toBe(0);
    expect(bonusSocialInsurance(1_000_000, true).nursing).toBe(8_100);
    expect(bonusSocialInsurance(1_000, true).nursing).toBe(8); // 8.10 → 8
  });
});

describe("E14 健保・介護・支援金は1本の保険料額（健保法156条1項1号・161条1項）", () => {
  // 保険料額＝標準賞与額×(健康保険9.90%＋子ども・子育て支援金0.23%＋介護1.62%)、
  // その二分の一が被保険者負担（161条1項）。50銭ルールが働くのは「この1本」に対して1回だけ。
  // 3つを個別に折半・個別に丸めると法定額から最大2円ずれる（40〜64歳の40%・40歳未満の25%）。
  const combined = (std: number, isOver40: boolean) => {
    const ratePer100k = 4_950 + (isOver40 ? 810 : 0) + 115; // 従業員負担率の合算
    const scaled = std * ratePer100k;
    const yen = Math.floor(scaled / 100_000);
    return (scaled - yen * 100_000) * 2 > 100_000 ? yen + 1 : yen;
  };

  it("賞与601,000円・40歳以上・前月給与400,000円 → 社会保険料93,305円・手取り445,493円", () => {
    // 601,000×11.75%÷2＝35,308.75 → 切上35,309（個別に丸めると 29,749+4,868+691＝35,308 で1円不足）
    const r = calc({ bonusAmount: 601_000, previousMonthSalary: 400_000, isOver40: true });
    expect(r.healthNursingChildCareTotal).toBe(35_309);
    expect(r.healthInsurance).toBe(29_750); // 厳密29,749.50＋按分1円
    expect(r.nursingInsurance).toBe(4_868); // 厳密4,868.10
    expect(r.childCareSupportLevy).toBe(691); // 厳密691.15
    expect(r.pensionInsurance).toBe(54_991); // 601,000×9.15%＝54,991.50 → 54,991（別枠の丸め）
    expect(r.employmentInsurance).toBe(3_005);
    expect(r.socialInsurance).toBe(93_305);
    expect(r.incomeTax).toBe(62_202);
    expect(r.takeHome).toBe(445_493);
  });

  it("賞与401,000円・40歳以上 → 合算23,559円（個別丸めの23,558円は1円不足）", () => {
    const r = calc({ bonusAmount: 401_000, previousMonthSalary: 400_000, isOver40: true });
    expect(r.healthNursingChildCareTotal).toBe(23_559); // 401,000×5.875%＝23,558.75 → 切上
    expect(19_849 + 3_248 + 461).toBe(23_558); // 個別に丸めた場合（誤り）
    expect(r.healthInsurance).toBe(19_850);
    expect(r.socialInsurance).toBe(62_255);
    expect(r.takeHome).toBe(297_242);
  });

  it("賞与755,000円・40歳以上 → 合算44,356円（個別丸めの44,355円は1円不足）", () => {
    const r = calc({ bonusAmount: 755_000, previousMonthSalary: 400_000, isOver40: true });
    expect(r.healthNursingChildCareTotal).toBe(44_356); // 755,000×5.875%＝44,356.25 → 切捨
    expect(37_372 + 6_115 + 868).toBe(44_355); // 個別に丸めた場合（誤り）
    // 健保・介護の端数が同値(0.50)なので、宣言順どおり健保に1円を配る
    expect(r.healthInsurance).toBe(37_373);
    expect(r.nursingInsurance).toBe(6_115);
    expect(r.socialInsurance).toBe(117_213);
    expect(r.takeHome).toBe(559_646);
  });

  it("賞与555,000円・40歳未満 → 合算28,111円（介護なしでも個別丸めはずれる）", () => {
    const r = calc({ bonusAmount: 555_000, previousMonthSalary: 400_000 });
    expect(r.healthNursingChildCareTotal).toBe(28_111); // 555,000×5.065%＝28,110.75 → 切上
    expect(27_472 + 638).toBe(28_110); // 個別に丸めた場合（誤り）
    expect(r.healthInsurance).toBe(27_473);
    expect(r.nursingInsurance).toBe(0);
    expect(r.childCareSupportLevy).toBe(638);
    expect(r.socialInsurance).toBe(81_668);
    expect(r.takeHome).toBe(415_340);
  });

  it("内訳は表示用の分解: 健保＋介護＋支援金は常に1本の法定額に一致する", () => {
    for (let bonus = 0; bonus <= 3_000_000; bonus += 1_000) {
      for (const isOver40 of [false, true]) {
        const r = bonusSocialInsurance(bonus, isOver40);
        const expected = combined(r.standardBonusHealth, isOver40);
        expect(r.healthGroupTotal).toBe(expected);
        expect(r.health + r.nursing + r.childCare).toBe(expected);
        if (!isOver40) expect(r.nursing).toBe(0); // 率0の内訳に按分の1円は回らない
      }
    }
  });

  it("按分しても各内訳は厳密額から1円以上離れない", () => {
    for (let bonus = 1_000; bonus <= 3_000_000; bonus += 7_000) {
      for (const isOver40 of [false, true]) {
        const r = bonusSocialInsurance(bonus, isOver40);
        const base = r.standardBonusHealth;
        expect(Math.abs(r.health - (base * 4_950) / 100_000)).toBeLessThan(1);
        expect(Math.abs(r.nursing - (base * (isOver40 ? 810 : 0)) / 100_000)).toBeLessThan(1);
        expect(Math.abs(r.childCare - (base * 115) / 100_000)).toBeLessThan(1);
      }
    }
  });

  it("年度累計573万円で打ち切られた基礎にも、合算1回の丸めが働く", () => {
    // 累計5,430,000 のあとの賞与301,000 → 健保等の基礎は300,000（差分のみ）
    const r = calc({
      bonusAmount: 301_000,
      previousMonthSalary: 400_000,
      isOver40: true,
      fiscalYearHealthBonusTotal: 5_430_000,
    });
    expect(r.standardBonusHealth).toBe(300_000);
    expect(r.healthNursingChildCareTotal).toBe(combined(300_000, true));
    expect(r.healthInsurance + r.nursingInsurance + r.childCareSupportLevy).toBe(
      r.healthNursingChildCareTotal,
    );
  });

  it("厚年・雇用保険は合算せず個別に丸める（算定基礎も上限も別のため）", () => {
    // 標準賞与額1,000円: 健保群は合算1回で51円だが、厚年は91.50→91、雇用保険は5円で独立
    const r = bonusSocialInsurance(1_000, false);
    expect(r.total).toBe(r.healthGroupTotal + r.pension + r.employment);
    // 厚年だけ月150万円上限・雇用保険だけ実額基礎という違いが残っていること
    const big = bonusSocialInsurance(3_000_000, true);
    expect(big.standardBonusPension).toBe(1_500_000);
    expect(big.standardBonusHealth).toBe(3_000_000);
    expect(big.employment).toBe(15_000); // 実額3,000,000×0.5%（標準賞与額でも上限でもない）
  });
});

describe("E14 月額表による計算が必要なケース（算出率の表を使えない）", () => {
  it("前月の給与がない（または社会保険料以下）ときは例外", () => {
    expect(requiresMonthlyTableMethod({
      bonusAmount: 500_000, previousMonthSalary: 0, isOver40: false,
    })).toBe(true);
    expect(() => calc({ bonusAmount: 500_000, previousMonthSalary: 0 })).toThrow(/月額表/);
  });

  it("賞与が前月給与（社保控除後）の10倍を超えるときは例外", () => {
    expect(() => calc({ bonusAmount: 2_000_000, previousMonthSalary: 100_000 })).toThrow(/月額表/);
  });

  it("10倍以下なら通常どおり算出率の表で計算する", () => {
    const input = { bonusAmount: 2_200_000, previousMonthSalary: 200_000, isOver40: false };
    expect(requiresMonthlyTableMethod(input)).toBe(false);
    expect(() => calculateBonusNetPay(input)).not.toThrow();
    // 10倍判定は「社会保険料控除後どうし」で行う（額面 2,200,000 は 200,000×10 を超えるが、
    // 社会保険料を引いた額は超えないので算出率の表が使える）
    const r = calculateBonusNetPay(input);
    expect(2_200_000).toBeGreaterThan(200_000 * 10);
    expect(2_200_000 - r.socialInsurance).toBeLessThanOrEqual(200_000 * 10);
  });

  it("賞与0なら前月給与0でも例外にならない（課税対象が無い）", () => {
    expect(requiresMonthlyTableMethod({
      bonusAmount: 0, previousMonthSalary: 0, isOver40: false,
    })).toBe(false);
    expect(calc({ bonusAmount: 0, previousMonthSalary: 0 }).takeHome).toBe(0);
  });
});

describe("E14 入力の正規化（clampNonNeg と同じ挙動）", () => {
  for (const bad of [0, -1, -500_000, NaN, Infinity, -Infinity]) {
    it(`賞与 ${bad} はすべて0として扱う`, () => {
      const r = calc({ bonusAmount: bad });
      expect(r.standardBonus).toBe(0);
      expect(r.socialInsurance).toBe(0);
      expect(r.incomeTax).toBe(0);
      expect(r.takeHome).toBe(0);
      expect(r.takeHomeRate).toBe(0); // 0除算しない
    });
  }

  it("前月給与の負値・非数は0として扱う（＝月額表ケースになり例外）", () => {
    expect(() => calc({ bonusAmount: 500_000, previousMonthSalary: -100 })).toThrow(/月額表/);
    expect(() => calc({ bonusAmount: 500_000, previousMonthSalary: NaN })).toThrow(/月額表/);
  });

  it("年度累計の負値・非数は0として扱う", () => {
    const r = calc({ bonusAmount: 500_000, fiscalYearHealthBonusTotal: NaN });
    expect(r.standardBonusHealth).toBe(500_000);
    expect(calc({ bonusAmount: 500_000, fiscalYearHealthBonusTotal: -1 }).standardBonusHealth).toBe(
      500_000,
    );
  });

  it("1円未満の入力は切り捨てて整数円で扱う", () => {
    expect(bonusSocialInsurance(300_100.9, false).employment).toBe(1_500);
  });
});

describe("E14 賞与の手取り worked example（記事が引用する確定値）", () => {
  it("賞与50万・前月給与30万・40歳未満 → 手取り400,303円", () => {
    const r = calc({ bonusAmount: 500_000, previousMonthSalary: 300_000 });
    expect(r.standardBonus).toBe(500_000);
    expect(r.healthInsurance).toBe(24_750);
    expect(r.nursingInsurance).toBe(0);
    expect(r.pensionInsurance).toBe(45_750);
    expect(r.childCareSupportLevy).toBe(575);
    expect(r.employmentInsurance).toBe(2_500);
    expect(r.socialInsurance).toBe(73_575);
    expect(r.withholdingRate).toBe(6.126);
    expect(r.incomeTax).toBe(26_122);
    expect(r.residentTax).toBe(0);
    expect(r.totalDeduction).toBe(99_697);
    expect(r.takeHome).toBe(400_303);
    expect(r.takeHomeRate).toBeCloseTo(0.8006, 4);
  });

  it("賞与50万・前月給与30万・40歳以上 → 手取り396,501円（介護4,050円）", () => {
    const r = calc({ bonusAmount: 500_000, previousMonthSalary: 300_000, isOver40: true });
    expect(r.nursingInsurance).toBe(4_050);
    expect(r.socialInsurance).toBe(77_625);
    expect(r.incomeTax).toBe(25_874); // 社保が増えた分だけ課税対象が減る
    expect(r.takeHome).toBe(396_501);
  });

  it("賞与30万・前月給与25万・40歳未満 → 手取り245,406円", () => {
    const r = calc({ bonusAmount: 300_000, previousMonthSalary: 250_000 });
    expect(r.socialInsurance).toBe(44_145);
    expect(r.withholdingRate).toBe(4.084);
    expect(r.incomeTax).toBe(10_449);
    expect(r.takeHome).toBe(245_406);
  });

  it("賞与100万・前月給与40万・40歳未満 → 手取り748,359円", () => {
    const r = calc({ bonusAmount: 1_000_000, previousMonthSalary: 400_000 });
    expect(r.healthInsurance).toBe(49_500);
    expect(r.pensionInsurance).toBe(91_500);
    expect(r.childCareSupportLevy).toBe(1_150);
    expect(r.employmentInsurance).toBe(5_000);
    expect(r.socialInsurance).toBe(147_150);
    expect(r.withholdingRate).toBe(12.252);
    expect(r.incomeTax).toBe(104_491);
    expect(r.takeHome).toBe(748_359);
  });

  it("賞与200万・前月給与60万・40歳未満 → 手取り1,429,569円（厚年は150万で頭打ち）", () => {
    const r = calc({ bonusAmount: 2_000_000, previousMonthSalary: 600_000 });
    expect(r.standardBonusPension).toBe(1_500_000);
    expect(r.pensionInsurance).toBe(137_250); // 200万ではなく150万に9.15%
    expect(r.healthInsurance).toBe(99_000); // 健保は年度573万まで全額が対象
    expect(r.socialInsurance).toBe(248_550);
    expect(r.withholdingRate).toBe(18.378);
    expect(r.incomeTax).toBe(321_881);
    expect(r.takeHome).toBe(1_429_569);
  });

  it("年度累計550万のあとの賞与30万 → 健保の対象は23万だけ（手取り243,511円）", () => {
    const r = calc({ bonusAmount: 300_000, fiscalYearHealthBonusTotal: 5_500_000 });
    expect(r.standardBonusHealth).toBe(230_000);
    expect(r.healthInsurance).toBe(11_385);
    expect(r.childCareSupportLevy).toBe(264); // 264.50 → 切捨
    expect(r.socialInsurance).toBe(40_599);
    expect(r.takeHome).toBe(243_511);
  });
});

describe("記事 worked example: ボーナスの手取り（shoyo-tedori 記事の裏取り）", () => {
  // 上の worked example で固定済みの値に加え、記事本文が引用する「差額」「手取り率」
  // 「上限が無かった場合の額」を固定する（§品質ゲート①：記事の数字は必ず calc で再現する）。
  /** 手取り率を記事の表記（小数第1位までの%）に丸める */
  const pct = (r: { takeHomeRate: number }) => Math.round(r.takeHomeRate * 1000) / 10;

  it("賞与456,789円の標準賞与額は456,000円・端数789円には保険料がかからない", () => {
    const r = bonusSocialInsurance(456_789, false);
    expect(r.standardBonus).toBe(456_000);
    expect(456_789 - r.standardBonus).toBe(789);
  });

  it("賞与30万・前月給与30万・40歳未満 → 手取り240,182円（前月給与25万との比較用）", () => {
    const r = calc({ bonusAmount: 300_000, previousMonthSalary: 300_000 });
    expect(r.socialInsurance).toBe(44_145); // 前月給与が違っても社会保険料は同額
    expect(r.withholdingRate).toBe(6.126);
    expect(r.incomeTax).toBe(15_673);
    expect(r.totalDeduction).toBe(59_818);
    expect(r.takeHome).toBe(240_182);
  });

  it("同じ賞与30万でも前月給与25万→30万で手取りが5,224円減る（率が4.084%→6.126%）", () => {
    const prev25 = calc({ bonusAmount: 300_000, previousMonthSalary: 250_000 });
    const prev30 = calc({ bonusAmount: 300_000, previousMonthSalary: 300_000 });
    expect(prev25.takeHome - prev30.takeHome).toBe(5_224);
    expect(prev25.socialInsurance).toBe(prev30.socialInsurance); // 差は所得税だけ
  });

  it("40歳以上は賞与50万で手取りが3,802円少ない", () => {
    const under = calc({ bonusAmount: 500_000, previousMonthSalary: 300_000 });
    const over = calc({ bonusAmount: 500_000, previousMonthSalary: 300_000, isOver40: true });
    expect(under.takeHome - over.takeHome).toBe(3_802);
  });

  it("年度累計550万のあとの賞与30万は、累計0のときより手取りが3,329円多い", () => {
    const base = calc({ bonusAmount: 300_000, previousMonthSalary: 300_000 });
    const capped = calc({
      bonusAmount: 300_000,
      previousMonthSalary: 300_000,
      fiscalYearHealthBonusTotal: 5_500_000,
    });
    expect(capped.takeHome - base.takeHome).toBe(3_329);
  });

  it("厚年の上限が無ければ賞与200万の保険料は183,000円、上限適用で137,250円（45,750円軽い）", () => {
    const r = calc({ bonusAmount: 2_000_000, previousMonthSalary: 600_000 });
    expect(Math.round(2_000_000 * 0.0915)).toBe(183_000); // 上限が無かった場合
    expect(r.pensionInsurance).toBe(137_250);
    expect(183_000 - r.pensionInsurance).toBe(45_750);
    expect(r.standardBonus - r.standardBonusPension).toBe(500_000); // 対象外になる50万円
  });

  it("賞与100万の社会保険料の内訳（記事の料率の裏取り）", () => {
    const r = bonusSocialInsurance(1_000_000, true);
    expect(r.health).toBe(49_500); // 4.95%
    expect(r.nursing).toBe(8_100); // 0.81%
    expect(r.pension).toBe(91_500); // 9.15%
    expect(r.childCare).toBe(1_150); // 0.115%
    expect(r.employment).toBe(5_000); // 0.5%
  });

  it("記事の早見（賞与額別）の手取り率", () => {
    expect(pct(calc({ bonusAmount: 300_000, previousMonthSalary: 250_000 }))).toBe(81.8);
    expect(pct(calc({ bonusAmount: 500_000, previousMonthSalary: 300_000 }))).toBe(80.1);
    expect(pct(calc({ bonusAmount: 1_000_000, previousMonthSalary: 400_000 }))).toBe(74.8);
    expect(pct(calc({ bonusAmount: 2_000_000, previousMonthSalary: 600_000 }))).toBe(71.5);
    // 40歳以上・年度上限到達後も本文が引用する
    expect(pct(calc({ bonusAmount: 500_000, previousMonthSalary: 300_000, isOver40: true }))).toBe(
      79.3,
    );
    expect(
      pct(calc({ bonusAmount: 300_000, previousMonthSalary: 300_000, fiscalYearHealthBonusTotal: 5_500_000 })),
    ).toBe(81.2);
  });

  it("記事の主張: 差し引き額で最大なのは所得税ではなく厚生年金（賞与50万の内訳）", () => {
    const r = calc({ bonusAmount: 500_000, previousMonthSalary: 300_000 });
    const parts = [
      r.healthInsurance,
      r.nursingInsurance,
      r.childCareSupportLevy,
      r.employmentInsurance,
      r.incomeTax,
    ];
    expect(Math.max(...parts, r.pensionInsurance)).toBe(r.pensionInsurance);
    expect(r.pensionInsurance).toBe(45_750);
    expect(r.pensionInsurance).toBeGreaterThan(r.incomeTax); // 「最も大きいのは所得税ではなく」
  });

  it("記事の主張: 賞与3,000,000円でも厚年は137,250円で頭打ち・雇用保険は15,000円まで伸びる", () => {
    const r = bonusSocialInsurance(3_000_000, false);
    expect(r.pension).toBe(137_250); // 150万円で頭打ち
    expect(r.employment).toBe(15_000); // 上限なし・実額の0.5%
  });

  it("記事の主張: 前月給与が同じなら賞与額が変わっても源泉徴収税率は変わらない", () => {
    for (const b of [300_000, 500_000, 1_000_000]) {
      expect(calc({ bonusAmount: b, previousMonthSalary: 300_000 }).withholdingRate).toBe(6.126);
    }
  });

  it("記事④の主張: 賞与50万の手取り率 約80.1% ＞ 年収500万の給与の手取り率 約78.0%", () => {
    // 【この比較が成立する前提】給与側（calculations.ts）と賞与側（bonus.ts）が
    // 同じ料率（rates.ts・令和8年度）で計算されていること。かつては給与側が令和7年度
    // ＋雇用保険の誤値（0.6%）のままで、年度をまたいだ比較になっていた。
    // 料率統一後の再導出でも主張は成立する（賞与80.06% > 給与78.01%・差 約2.05pp）。
    const bonus = calc({ bonusAmount: 500_000, previousMonthSalary: 300_000 });
    const salary = calculateNetSalary({ annualIncome: 5_000_000, isOver40: false });
    expect(bonus.takeHomeRate).toBeGreaterThan(salary.takeHomeRate);
    // 記事が本文に書く「約80.1%」「約78.0%」をそのまま固定する
    expect(pct(bonus)).toBe(80.1);
    expect(pct(salary)).toBe(78.0);
    // 差の大きさも固定する（符号だけだと料率 drift を検知できないため）
    expect(Math.round((bonus.takeHomeRate - salary.takeHomeRate) * 10_000) / 100).toBe(2.05);
    // 両者が同じ年度の料率であることの直接確認（給与側に令和8年度の支援金が乗っている）
    expect(salary.childCareSupportLevy).toBe(5_750); // 500万 × 0.115%
  });

  it("記事④の主張: 一般則ではなく年収600万以上では逆転する（76.6%対77.0%・71.4%対74.3%）", () => {
    // 賞与の源泉徴収税率は前月給与で階段状に上がるため、年収が上がると賞与側の率が
    // 給与側の平均税率を追い越す。記事 shoyo-tedori ④はこの反例を本文に書いたうえで
    // 「賞与のほうが高い」を年収500万・賞与50万の例に限定している。一般化してはいけない。
    const cases: Array<[number, number, number, number, number]> = [
      // [年収, 賞与, 前月給与（社保控除後）, 記事が書く賞与の手取り率, 同 給与の手取り率]
      [6_000_000, 600_000, 350_000, 76.6, 77.0],
      [8_000_000, 800_000, 450_000, 71.4, 74.3],
    ];
    for (const [income, bonusAmount, previousMonthSalary, bonusPct, salaryPct] of cases) {
      const bonus = calc({ bonusAmount, previousMonthSalary });
      const salary = calculateNetSalary({ annualIncome: income, isOver40: false });
      expect(bonus.takeHomeRate).toBeLessThan(salary.takeHomeRate);
      expect(pct(bonus)).toBe(bonusPct);
      expect(pct(salary)).toBe(salaryPct);
    }
  });
});

describe("記事 shoyo-tedori の本文と計算結果の突き合わせ（prose ↔ code）", () => {
  // 上の describe は「計算結果」を固定するが、それだけでは記事本文が固定値から
  // ずれても気づけない（実際、573万到達後の段落が所得税を落として手取りを
  // 16,604円多く見せていた）。ここでは記事の文字列そのものに計算結果が
  // 現れているかを検査し、prose と code の両方向の drift を CI で赤にする。
  const article = getAllArticles().find((a) => a.slug === "shoyo-tedori")!;
  const body = [article.description, ...article.sections.flatMap((s) => [s.heading ?? "", ...s.paragraphs])].join("\n");

  /** 記事の表記に合わせて整形する（3桁区切り＋円） */
  const yen = (n: number) => `${n.toLocaleString("en-US")}円`;
  /** 記事の表記に合わせた手取り率（小数第1位まで・78 → "78.0"） */
  const ratePct = (r: { takeHomeRate: number }) => `${(Math.round(r.takeHomeRate * 1000) / 10).toFixed(1)}%`;
  const contains = (s: string) => expect(body, `記事本文に「${s}」が無い`).toContain(s);

  it("§賞与50万円の手取り内訳（前月給与30万円・40歳未満）", () => {
    const r = calc({ bonusAmount: 500_000, previousMonthSalary: 300_000 });
    for (const n of [
      r.standardBonus, r.healthInsurance, r.pensionInsurance, r.childCareSupportLevy,
      r.employmentInsurance, r.socialInsurance, r.incomeTax, r.totalDeduction, r.takeHome,
    ]) contains(yen(n));
    contains(`${r.withholdingRate}%`);
    contains(ratePct(r));
  });

  it("§① 標準賞与額（456,789円 → 456,000円・端数789円）", () => {
    const r = bonusSocialInsurance(456_789, false);
    contains(yen(r.standardBonus));
    contains(yen(456_789 - r.standardBonus));
  });

  it("§② 厚年の月150万円上限（賞与200万・前月給与60万）", () => {
    const r = calc({ bonusAmount: 2_000_000, previousMonthSalary: 600_000 });
    for (const n of [
      r.standardBonusPension, r.pensionInsurance, r.takeHome,
      Math.round(2_000_000 * 0.0915), // 上限が無かった場合の183,000円
      Math.round(2_000_000 * 0.0915) - r.pensionInsurance, // 45,750円ぶん軽い
      r.standardBonus - r.standardBonusPension, // 対象外の500,000円
    ]) contains(yen(n));
    contains(ratePct(r));
  });

  it("§② 健保の年度累計573万円上限（累計550万のあとの賞与30万）", () => {
    const r = calc({ bonusAmount: 300_000, fiscalYearHealthBonusTotal: 5_500_000 });
    const base = calc({ bonusAmount: 300_000 });
    for (const n of [
      r.standardBonusHealth, r.healthInsurance, r.childCareSupportLevy,
      r.socialInsurance, r.takeHome, base.takeHome, r.takeHome - base.takeHome,
    ]) contains(yen(n));
    contains(ratePct(r));
  });

  it("§② 573万円到達後（Defect A: 社会保険料28,950円だけでなく所得税も引かれる）", () => {
    const r = calc({ bonusAmount: 300_000, fiscalYearHealthBonusTotal: 5_730_000 });
    for (const n of [
      r.pensionInsurance, r.employmentInsurance, r.socialInsurance,
      r.incomeTax, r.totalDeduction, r.takeHome,
    ]) contains(yen(n));
    contains(ratePct(r));
    // 「引かれるのは…28,950円だけです」（所得税を落とした旧文言）が復活しないこと
    expect(body).not.toContain(`引かれるのは厚生年金保険料${yen(r.pensionInsurance)}`);
    // 社会保険料と控除合計が別物として書かれていること
    expect(body).toContain(`社会保険料は厚生年金保険料${yen(r.pensionInsurance)}`);
  });

  it("§② 雇用保険には上限がない（賞与300万）", () => {
    const r = bonusSocialInsurance(3_000_000, false);
    contains(yen(r.pension));
    contains(yen(r.employment));
  });

  it("§③ 前月給与で率が変わる（賞与30万・前月25万 vs 30万）", () => {
    const prev25 = calc({ bonusAmount: 300_000, previousMonthSalary: 250_000 });
    const prev30 = calc({ bonusAmount: 300_000, previousMonthSalary: 300_000 });
    for (const n of [
      prev25.incomeTax, prev25.takeHome, prev30.incomeTax, prev30.takeHome,
      prev25.takeHome - prev30.takeHome, prev25.socialInsurance,
    ]) contains(yen(n));
    contains(`${prev25.withholdingRate}%`);
    contains(`${prev30.withholdingRate}%`);
    contains(ratePct(prev25));
  });

  it("§④ 手取り率の比較（賞与 vs 給与・成立する例と逆転する反例）", () => {
    const b5 = calc({ bonusAmount: 500_000, previousMonthSalary: 300_000 });
    contains(ratePct(b5));
    contains(ratePct(calculateNetSalary({ annualIncome: 5_000_000, isOver40: false })));
    for (const [income, bonusAmount, previousMonthSalary] of [
      [6_000_000, 600_000, 350_000],
      [8_000_000, 800_000, 450_000],
    ] as const) {
      contains(ratePct(calc({ bonusAmount, previousMonthSalary })));
      contains(ratePct(calculateNetSalary({ annualIncome: income, isOver40: false })));
    }
  });

  it("§40歳以上は介護保険料が上乗せされる", () => {
    const under = calc({ bonusAmount: 500_000, previousMonthSalary: 300_000 });
    const over = calc({ bonusAmount: 500_000, previousMonthSalary: 300_000, isOver40: true });
    for (const n of [
      over.nursingInsurance, under.socialInsurance, over.socialInsurance,
      under.incomeTax, over.incomeTax, over.takeHome, under.takeHome - over.takeHome,
    ]) contains(yen(n));
    contains(ratePct(over));
  });

  it("§賞与額別の手取りの目安", () => {
    for (const [bonusAmount, previousMonthSalary] of [
      [300_000, 250_000], [500_000, 300_000], [1_000_000, 400_000], [2_000_000, 600_000],
    ] as const) {
      const r = calc({ bonusAmount, previousMonthSalary });
      contains(yen(r.takeHome));
      contains(ratePct(r));
    }
    // 賞与100万の内訳（40歳以上の介護保険料も本文が引用する）
    const si = bonusSocialInsurance(1_000_000, true);
    const r = calc({ bonusAmount: 1_000_000, previousMonthSalary: 400_000 });
    for (const n of [si.health, si.pension, si.childCare, si.employment, si.nursing, r.socialInsurance, r.incomeTax])
      contains(yen(n));
    contains(`${r.withholdingRate}%`);
  });

  it("§③ 源泉徴収税率の表の境界（本文が引用する率と金額）", () => {
    contains(yen(82_000));
    contains(yen(260_000));
    contains(yen(309_000));
    contains(yen(3_495_000));
    contains(`${bonusWithholdingRate(260_000)}%`); // 6.126%
    contains(`${bonusWithholdingRate(3_495_000)}%`); // 45.945%
  });

  it("§本文が引用する上限額は rates.ts の宣言値と一致する（Defect C: 単位は「その月」）", () => {
    contains(yen(BONUS_CAP.pensionMonthly)); // 1,500,000円
    contains(yen(BONUS_CAP.healthFiscalYear)); // 5,730,000円
    // 厚年の上限は「1回」ではなく「その月」の標準賞与額に対して働く
    expect(body).toContain("「その月における標準賞与額 1,500,000円」が上限");
    expect(body).toContain("賞与1回ごとではなく「その月」");
    expect(body).not.toMatch(/厚生年金[はの]?1回150万円/); // 旧 heading / description の文言
    expect(article.description).toContain("厚生年金のその月150万円");
  });
});

describe("記事 shoyo-tedori の scenario lock（入力と出力を1つの連続文字列で固定）", () => {
  // ─────────────────────────────────────────────────────────────
  //  なぜ上の prose ↔ code describe だけでは足りないか（gate hole の塞ぎ）
  //
  //  ① 料率の literal（「4.95%」「0.5%」…）が rates.ts と繋がっていない。
  //     rates.test.ts は「コードの料率が正しいか」だけを見ているので、本文の
  //     「賞与の額面の0.5%」を「0.6%」に書き換えても全テストが green のままだった。
  //     0.6% は rates.ts を作る原因になった雇用保険の誤値そのものである。
  //     → 本文が書く率は RATE_EMP_P100K から組み立てた文字列で照合する。
  //
  //  ② 上の describe の contains() は「本文のどこかに出る」だけを見るため、
  //     シナリオの **入力** が一切ロックされていない。実証: 早見の
  //     「賞与500,000円（前月給与300,000円）：手取り 400,303円」の前月給与を
  //     250,000円に書き換えても、"250,000円" も "400,303円" も本文の別の場所に
  //     出るため green のまま。実際の 500,000/250,000 の手取りは 409,010円で、
  //     公開値は 8,707円ずれる。
  //     → 入力と出力を **1つの連続した部分文字列** として照合する。
  //
  //  したがってここでは calc の出力だけでなく、記事が前提として書いている入力
  //  （賞与額・前月給与・年度累計・年収）も同じテンプレートに埋め込む。
  // ─────────────────────────────────────────────────────────────
  const article = getAllArticles().find((a) => a.slug === "shoyo-tedori")!;
  const body = [
    article.description,
    ...article.sections.flatMap((s) => [s.heading ?? "", ...s.paragraphs]),
  ].join("\n");

  /** 記事の表記に合わせて整形する（3桁区切り＋円） */
  const yen = (n: number) => `${n.toLocaleString("en-US")}円`;
  /** 記事の表記に合わせた手取り率（小数第1位まで） */
  const ratePct = (r: { takeHomeRate: number }) =>
    `${(Math.round(r.takeHomeRate * 1000) / 10).toFixed(1)}%`;
  /** 万円単位の表記（上限額の見出し・年収の言及） */
  const man = (n: number) => `${n / 10_000}万円`;
  /** 従業員負担率を記事の表記に戻す（10万分率 → "4.95%"）。出所は rates.ts だけ */
  const empPct = (k: keyof typeof RATE_EMP_P100K, digits: number) =>
    `${(RATE_EMP_P100K[k] / 1000).toFixed(digits)}%`;
  /** 復興特別所得税は算出率の表に織り込み済み（2.042 ＝ 2% × 1.021）。表から逆算する */
  const SURTAX_MULTIPLIER = bonusWithholdingRate(82_000) / 2; // 1.021
  const surtaxMul = SURTAX_MULTIPLIER.toFixed(3); // "1.021"
  const surtaxPct = `${((SURTAX_MULTIPLIER - 1) * 100).toFixed(1)}%`; // "2.1%"

  /** 「連続した部分文字列」として本文に出ることを要求する（分断されていたら赤） */
  const has = (s: string) =>
    expect(body, `記事本文に連続した文字列として「${s}」が無い`).toContain(s);

  // 記事が前提として明記しているシナリオ入力。テンプレートにも calc にも同じ定数を渡すので、
  // 本文の入力表記だけを書き換えると照合文字列が作れなくなり CI が赤になる。
  const MAIN = { bonus: 500_000, prev: 300_000 } as const;
  const main = calc({ bonusAmount: MAIN.bonus, previousMonthSalary: MAIN.prev });

  it("リード文と description（額面と手取りと前月給与が1文で結びついている）", () => {
    has(
      `賞与（ボーナス）の額面が${yen(MAIN.bonus)}でも、実際に振り込まれるのは${yen(main.takeHome)}です（前月の給与${yen(MAIN.prev)}・`,
    );
    expect(article.description).toContain(
      `額面${MAIN.bonus / 10_000}万円なら手取り${yen(main.takeHome)}`,
    );
    expect(article.description).toContain(
      `厚生年金のその月${man(BONUS_CAP.pensionMonthly)}と健康保険の年度${man(BONUS_CAP.healthFiscalYear)}という上限`,
    );
  });

  it("§賞与50万円の手取り内訳 — 各行の金額と料率（料率は rates.ts から導出）", () => {
    has(`賞与${MAIN.bonus / 10_000}万円の手取り内訳（前月給与${MAIN.prev / 10_000}万円・40歳未満）`);
    has(`賞与の額面 ${yen(MAIN.bonus)}、標準賞与額 ${yen(main.standardBonus)}。`);
    has(`健康保険料 ${yen(main.healthInsurance)}（標準賞与額の${empPct("health", 2)}）`);
    has(`介護保険料 ${yen(main.nursingInsurance)}（40歳未満のため）`);
    has(`厚生年金保険料 ${yen(main.pensionInsurance)}（同 ${empPct("pension", 2)}）`);
    has(
      `子ども・子育て支援金 ${yen(main.childCareSupportLevy)}（同 ${empPct("childCare", 3)}・令和8年4月分から）`,
    );
    has(
      `雇用保険料 ${yen(main.employmentInsurance)}（標準賞与額ではなく賞与の額面の${empPct("employment", 1)}）`,
    );
    has(`社会保険料の合計 ${yen(main.socialInsurance)}`);
    has(`所得税 ${yen(main.incomeTax)}（源泉徴収税率 ${main.withholdingRate}%）`);
    has(`住民税 ${yen(main.residentTax)}（賞与からは徴収されない）`);
    has(
      `差し引かれる合計 ${yen(main.totalDeduction)}、手取り ${yen(main.takeHome)}（手取り率 約${ratePct(main)}）`,
    );
    has(`なかでも厚生年金が${yen(main.pensionInsurance)}と最大です`);
  });

  it("§① 標準賞与額の切り捨てと、雇用保険だけ実額基礎（率は rates.ts から導出）", () => {
    const r = bonusSocialInsurance(456_789, false);
    has(
      `たとえば賞与が${yen(456_789)}なら標準賞与額は${yen(r.standardBonus)}で、端数の${yen(456_789 - r.standardBonus)}には保険料がかかりません。`,
    );
    has(
      `賞与の実額に${empPct("employment", 1)}（一般の事業・労働者負担）を掛けます。`,
    );
  });

  it("§② 厚年の月150万円上限 — 賞与200万・前月給与60万の全体が1文で結びついている", () => {
    const BONUS = 2_000_000;
    const PREV = 600_000;
    const r = calc({ bonusAmount: BONUS, previousMonthSalary: PREV });
    // 上限が無かった場合の保険料も rates.ts の料率から導出する
    const uncapped = Math.round((BONUS * RATE_EMP_P100K.pension) / 100_000);
    has(
      `② 厚生年金はその月${man(BONUS_CAP.pensionMonthly)}、健康保険は年度${man(BONUS_CAP.healthFiscalYear)}で頭打ち`,
    );
    has(`厚生年金は「その月における標準賞与額 ${yen(BONUS_CAP.pensionMonthly)}」が上限です`);
    has(
      `賞与${yen(BONUS)}・前月給与${yen(PREV)}の例では、厚生年金の算定の土台が${yen(r.standardBonusPension)}に切り下げられ、保険料は${yen(r.pensionInsurance)}になります。上限がなければ${yen(uncapped)}ですから、${yen(uncapped - r.pensionInsurance)}ぶん軽くなる計算です。上限を超えた${yen(r.standardBonus - r.standardBonusPension)}ぶんには厚生年金保険料がかかりません（このケースの手取りは${yen(r.takeHome)}・手取り率 約${ratePct(r)}）。`,
    );
  });

  it("§② 健保の年度累計573万円上限 — 累計・賞与額・前月給与と結果が1文で結びついている", () => {
    const BONUS = 300_000;
    const PREV = 300_000;
    const ACCUM = 5_500_000;
    const r = calc({
      bonusAmount: BONUS,
      previousMonthSalary: PREV,
      fiscalYearHealthBonusTotal: ACCUM,
    });
    const base = calc({ bonusAmount: BONUS, previousMonthSalary: PREV });
    has(
      `年度（4月1日〜翌年3月31日）の標準賞与額の累計で${yen(BONUS_CAP.healthFiscalYear)}です。`,
    );
    has(
      `年度の累計が${yen(ACCUM)}に達したあとに${yen(BONUS)}の賞与を受け取ると、健康保険の対象になるのは残りの${yen(r.standardBonusHealth)}だけになり、健康保険料は${yen(r.healthInsurance)}、子ども・子育て支援金は${yen(r.childCareSupportLevy)}まで下がります。社会保険料の合計は${yen(r.socialInsurance)}、手取りは${yen(r.takeHome)}（手取り率 約${ratePct(r)}）で、年度累計が0円のとき（同じ賞与${yen(BONUS)}・前月給与${yen(PREV)}）の手取り${yen(base.takeHome)}より${yen(r.takeHome - base.takeHome)}多く残ります。`,
    );
  });

  it("§② 累計573万円到達後 — 健保グループが0円になる主張と金額が1文で結びついている", () => {
    const BONUS = 300_000;
    const PREV = 300_000;
    const r = calc({
      bonusAmount: BONUS,
      previousMonthSalary: PREV,
      fiscalYearHealthBonusTotal: BONUS_CAP.healthFiscalYear,
    });
    // 「いずれも0円になります」が計算結果として本当であること
    expect(r.healthInsurance).toBe(0);
    expect(r.nursingInsurance).toBe(0);
    expect(r.childCareSupportLevy).toBe(0);
    has(
      `累計が${yen(BONUS_CAP.healthFiscalYear)}に達したあとの賞与では、健康保険料・介護保険料・子ども・子育て支援金がいずれも${yen(0)}になります。賞与${yen(BONUS)}（前月給与${yen(PREV)}）なら、社会保険料は厚生年金保険料${yen(r.pensionInsurance)}と雇用保険料${yen(r.employmentInsurance)}の合計${yen(r.socialInsurance)}だけです。ただし所得税はこれとは別に${yen(r.incomeTax)}が引かれるため、差し引かれる合計は${yen(r.totalDeduction)}、手取りは${yen(r.takeHome)}（手取り率 約${ratePct(r)}）になります。`,
    );
  });

  it("§② 雇用保険には上限がない（賞与300万の厚年と雇用保険が1文で結びついている）", () => {
    const BONUS = 3_000_000;
    const si = bonusSocialInsurance(BONUS, false);
    has(
      `賞与${yen(BONUS)}のケースでは厚生年金保険料が上限に張り付いて${yen(si.pension)}のままなのに対し、雇用保険料は${yen(si.employment)}まで素直に増えます。`,
    );
  });

  it("§③ 算出率の表の境界と復興特別所得税（率は bonusWithholdingRate から導出）", () => {
    has(
      `率は、前月の給与が${yen(82_000)}未満なら${bonusWithholdingRate(81_999)}%、${yen(260_000)}以上${yen(309_000)}未満なら${bonusWithholdingRate(260_000)}%で、上限は${yen(3_495_000)}以上の${bonusWithholdingRate(3_495_000)}%です。いずれも復興特別所得税（${surtaxPct}）を含んだ率なので、あとから${surtaxMul}を掛ける必要はありません。`,
    );
  });

  it("§③ 前月給与で率が変わる — 賞与額・前月給与2通りと結果が1文で結びついている", () => {
    const BONUS = 300_000;
    const p25 = calc({ bonusAmount: BONUS, previousMonthSalary: 250_000 });
    const p30 = calc({ bonusAmount: BONUS, previousMonthSalary: 300_000 });
    has(
      `賞与${yen(BONUS)}で前月の給与が${yen(250_000)}なら率は${p25.withholdingRate}%、所得税は${yen(p25.incomeTax)}、手取りは${yen(p25.takeHome)}（手取り率 約${ratePct(p25)}）。前月の給与が${yen(300_000)}だと率は${p30.withholdingRate}%に上がり、所得税は${yen(p30.incomeTax)}、手取りは${yen(p30.takeHome)}で${yen(p25.takeHome - p30.takeHome)}少なくなります。社会保険料はどちらも${yen(p25.socialInsurance)}で同額なので、差は所得税だけです。`,
    );
  });

  it("§④ 賞与 vs 給与の手取り率 — 年収・賞与・前月給与と両者の率が1文で結びついている", () => {
    const s5 = calculateNetSalary({ annualIncome: 5_000_000, isOver40: false });
    has(
      `上の例（賞与${yen(MAIN.bonus)}・前月給与${yen(MAIN.prev)}）の手取り率 約${ratePct(main)}が、年収${man(5_000_000)}の給与の手取り率 約${ratePct(s5)}を上回っている`,
    );
    const b6 = calc({ bonusAmount: 600_000, previousMonthSalary: 350_000 });
    const s6 = calculateNetSalary({ annualIncome: 6_000_000, isOver40: false });
    const b8 = calc({ bonusAmount: 800_000, previousMonthSalary: 450_000 });
    const s8 = calculateNetSalary({ annualIncome: 8_000_000, isOver40: false });
    has(
      `年収${man(6_000_000)}・賞与${yen(600_000)}・前月給与${yen(350_000)}では賞与の手取り率が約${ratePct(b6)}となり、給与の手取り率 約${ratePct(s6)}を下回ります。年収${man(8_000_000)}・賞与${yen(800_000)}・前月給与${yen(450_000)}ならその差はさらに開き、約${ratePct(b8)}対約${ratePct(s8)}です。`,
    );
  });

  it("§40歳以上の介護保険料 — 賞与・前月給与と介護料率・増減が1文で結びついている", () => {
    const over = calc({
      bonusAmount: MAIN.bonus,
      previousMonthSalary: MAIN.prev,
      isOver40: true,
    });
    has(
      `賞与${yen(MAIN.bonus)}・前月給与${yen(MAIN.prev)}の例では介護保険料${yen(over.nursingInsurance)}（標準賞与額の${empPct("nursing", 2)}）が加わり、社会保険料は${yen(main.socialInsurance)}から${yen(over.socialInsurance)}に増えます。`,
    );
    has(
      `所得税は${yen(main.incomeTax)}から${yen(over.incomeTax)}へわずかに下がります。それでも差し引きの手取りは${yen(over.takeHome)}（手取り率 約${ratePct(over)}）となり、40歳未満より${yen(main.takeHome - over.takeHome)}少なくなります。`,
    );
  });

  it("§賞与額別の早見 — 各行の賞与額・前月給与・手取り・手取り率が1行で結びついている", () => {
    // 「（前月給与300,000円）」だけを250,000円に書き換えると、この行の照合文字列が
    // 作れなくなって赤になる（本文の別の場所に 250,000円 があっても救われない）。
    const rows: Array<[number, number, string]> = [
      [300_000, 250_000, "手取り率 約"],
      [500_000, 300_000, "約"],
      [1_000_000, 400_000, "約"],
      [2_000_000, 600_000, "約"],
    ];
    for (const [bonusAmount, previousMonthSalary, ratePrefix] of rows) {
      const r = calc({ bonusAmount, previousMonthSalary });
      has(
        `賞与${yen(bonusAmount)}（前月給与${yen(previousMonthSalary)}）：手取り ${yen(r.takeHome)}（${ratePrefix}${ratePct(r)}）`,
      );
    }
  });

  it("§賞与額別の早見 — 賞与100万の内訳の1文（各料率の金額と源泉徴収税率）", () => {
    const BONUS = 1_000_000;
    const PREV = 400_000;
    const si = bonusSocialInsurance(BONUS, true);
    const r = calc({ bonusAmount: BONUS, previousMonthSalary: PREV });
    has(
      `参考までに、賞与${yen(BONUS)}のときの社会保険料の内訳は、健康保険${yen(si.health)}・厚生年金${yen(si.pension)}・子ども・子育て支援金${yen(si.childCare)}・雇用保険${yen(si.employment)}で合計${yen(r.socialInsurance)}（40歳以上ならさらに介護保険${yen(si.nursing)}）、所得税は源泉徴収税率${r.withholdingRate}%で${yen(r.incomeTax)}です。`,
    );
  });
});

describe("E14 不変条件", () => {
  const grid = [100_000, 300_000, 500_000, 1_000_000, 2_000_000, 3_000_000, 5_000_000];
  const prev = 1_000_000; // 10倍ルールに触れない前月給与

  it("手取りは0以上・額面以下", () => {
    for (const b of grid) {
      const r = calc({ bonusAmount: b, previousMonthSalary: prev });
      expect(r.takeHome).toBeGreaterThanOrEqual(0);
      expect(r.takeHome).toBeLessThanOrEqual(b);
      expect(r.takeHome).toBe(b - r.totalDeduction);
    }
  });

  it("賞与が増えれば手取りも増える（単調性）", () => {
    for (let i = 1; i < grid.length; i++) {
      expect(calc({ bonusAmount: grid[i], previousMonthSalary: prev }).takeHome).toBeGreaterThan(
        calc({ bonusAmount: grid[i - 1], previousMonthSalary: prev }).takeHome,
      );
    }
  });

  it("40歳以上の手取りは40歳未満以下（介護保険料の分だけ減る）", () => {
    for (const b of grid) {
      const under = calc({ bonusAmount: b, previousMonthSalary: prev, isOver40: false });
      const over = calc({ bonusAmount: b, previousMonthSalary: prev, isOver40: true });
      expect(over.takeHome).toBeLessThanOrEqual(under.takeHome);
    }
  });

  it("内訳の合計は社会保険料合計・控除合計と一致する", () => {
    for (const b of grid) {
      const r = calc({ bonusAmount: b, previousMonthSalary: prev, isOver40: true });
      expect(
        r.healthInsurance +
          r.nursingInsurance +
          r.pensionInsurance +
          r.childCareSupportLevy +
          r.employmentInsurance,
      ).toBe(r.socialInsurance);
      // 健保・介護・支援金は1本の法定額の分解なので、3つの和は必ず合算額に一致する
      expect(r.healthInsurance + r.nursingInsurance + r.childCareSupportLevy).toBe(
        r.healthNursingChildCareTotal,
      );
      expect(r.socialInsurance).toBe(
        r.healthNursingChildCareTotal + r.pensionInsurance + r.employmentInsurance,
      );
      expect(r.socialInsurance + r.incomeTax + r.residentTax).toBe(r.totalDeduction);
    }
  });

  it("住民税は賞与から徴収されないため常に0", () => {
    for (const b of grid) {
      expect(calc({ bonusAmount: b, previousMonthSalary: prev }).residentTax).toBe(0);
    }
  });
});
