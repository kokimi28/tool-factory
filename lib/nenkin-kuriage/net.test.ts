/**
 * 年金の手取り（D12）のテスト。
 *
 * この計算は条文を写したものなので、テストの役目は
 *  ① 一次資料に載っている検算例を再現できるか（国税庁 No.1600 の例1）
 *  ② 条文の構造（イ＋ロ・下限・65歳の読み替え・他所得の帯）を境界で確かめる
 *  ③ 丸め（1,000円未満・100円未満切捨）が効いているか
 *  ④ 自治体で変わる部分が引数として本当に効いているか
 *  ⑤ 記事の数値が実装から出た値と一致しているか
 * の5点。
 *
 * ②が重要な理由: 65歳未満と65歳以上で公的年金等控除の下限が 60万/110万 と変わる。
 * 繰上げ受給（60〜64歳）はこの差が丸ごと手取りに乗るので、開始年齢だけで
 * 一律に「65歳以上」として計算すると繰上げの手取りを過大に見積もる。
 */
import { describe, expect, it } from 'vitest';

import { breakEvenAgeVs65, monthlyPension, pensionScenario } from './calculations';
import { getArticle } from './articles';
import {
  RESIDENT_TAX,
  annualNetAt,
  basicDeductionResidentTax,
  breakEvenAgeVs65Net,
  cumulativeNetPension,
  netScenario,
  pensionNet,
  publicPensionDeduction,
  publicPensionMiscIncome,
} from './net';

const BASE = 150_000; // 65歳時点で月15万円（記事・シミュレーターの標準例）

describe('一次資料の検算例を再現する', () => {
  it('国税庁 No.1600 例1: 65歳以上・他所得500万円・年金収入350万円 → 雑所得235万円', () => {
    // 3,500,000円×75％−275,000円＝2,350,000円
    expect(publicPensionMiscIncome(3_500_000, true, 5_000_000)).toBe(2_350_000);
  });

  it('速算表の各行を再現する（65歳以上・他所得1,000万円以下）', () => {
    const misc = (rev: number) => publicPensionMiscIncome(rev, true);
    expect(misc(1_100_000)).toBe(0); // 110万円以下 → 0円
    expect(misc(2_000_000)).toBe(2_000_000 - 1_100_000); // 110万円超330万円未満 → 収入−110万円
    expect(misc(3_500_000)).toBe(3_500_000 * 0.75 - 275_000); // 330万〜410万 → ×0.75−27.5万
    expect(misc(5_000_000)).toBe(5_000_000 * 0.85 - 685_000); // 410万〜770万 → ×0.85−68.5万
    expect(misc(8_000_000)).toBe(8_000_000 * 0.95 - 1_455_000); // 770万〜1,000万 → ×0.95−145.5万
    expect(misc(12_000_000)).toBe(12_000_000 - 1_955_000); // 1,000万以上 → 収入−195.5万
  });

  it('速算表の各行を再現する（65歳未満・他所得1,000万円以下）', () => {
    const misc = (rev: number) => publicPensionMiscIncome(rev, false);
    expect(misc(600_000)).toBe(0); // 60万円以下 → 0円
    expect(misc(1_000_000)).toBe(1_000_000 - 600_000); // 60万円超130万円未満 → 収入−60万円
    expect(misc(2_000_000)).toBe(2_000_000 * 0.75 - 275_000); // 130万〜410万 → ×0.75−27.5万
    expect(misc(5_000_000)).toBe(5_000_000 * 0.85 - 685_000);
  });

  it('他所得1,000万円超・2,000万円超では控除が10万円ずつ下がる（所得税法35条4項一〜三）', () => {
    const rev = 3_500_000;
    const under10M = publicPensionDeduction(rev, true, 5_000_000);
    const under20M = publicPensionDeduction(rev, true, 15_000_000);
    const over20M = publicPensionDeduction(rev, true, 25_000_000);
    expect(under10M - under20M).toBe(100_000);
    expect(under20M - over20M).toBe(100_000);
  });
});

describe('65歳未満と65歳以上の下限の読み替え（措置法41条の15の3）', () => {
  it('下限は 60万円 → 110万円（収入120万円は下限が効く水準）', () => {
    // 収入120万円: イ40万＋ロ17.5万＝57.5万 で下限を下回るので、下限がそのまま出る。
    // 収入が大きいと「イ＋ロ」のほうが勝って下限が見えなくなるため、小さい額で比べる。
    expect(publicPensionDeduction(1_200_000, false)).toBe(600_000);
    expect(publicPensionDeduction(1_200_000, true)).toBe(1_100_000);
  });

  it('他所得の帯ごとに下限が 50万→100万・40万→90万 と読み替わる', () => {
    expect(publicPensionDeduction(1_200_000, false, 15_000_000)).toBe(500_000);
    expect(publicPensionDeduction(1_200_000, true, 15_000_000)).toBe(1_000_000);
    expect(publicPensionDeduction(1_200_000, false, 25_000_000)).toBe(400_000);
    expect(publicPensionDeduction(1_200_000, true, 25_000_000)).toBe(900_000);
  });

  it('下限と「イ＋ロ」がちょうど一致する収入が速算表の帯の境目になっている', () => {
    // 65歳未満は130万円、65歳以上は330万円で 下限＝イ＋ロ。速算表がこの点で
    // 「収入−60万円」→「×0.75−27.5万円」に切り替わるのは、この一致が理由。
    expect(publicPensionDeduction(1_300_000, false)).toBe(600_000);
    expect(publicPensionDeduction(3_300_000, true)).toBe(1_100_000);
  });

  it('下限が効かない額（収入330万円以上）では65歳未満も以上も同じ控除になる', () => {
    expect(publicPensionDeduction(3_500_000, false)).toBe(publicPensionDeduction(3_500_000, true));
  });

  it('控除は収入を超えない（雑所得は負にならない）', () => {
    expect(publicPensionDeduction(300_000, true)).toBe(300_000);
    expect(publicPensionMiscIncome(300_000, true)).toBe(0);
    expect(publicPensionMiscIncome(0, true)).toBe(0);
  });
});

describe('住民税の基礎控除（地方税法314条の2第2項）', () => {
  it('2,400万円以下43万円・2,450万円以下29万円・2,500万円以下15万円・超は0', () => {
    expect(basicDeductionResidentTax(24_000_000)).toBe(430_000);
    expect(basicDeductionResidentTax(24_000_001)).toBe(290_000);
    expect(basicDeductionResidentTax(24_500_000)).toBe(290_000);
    expect(basicDeductionResidentTax(24_500_001)).toBe(150_000);
    expect(basicDeductionResidentTax(25_000_000)).toBe(150_000);
    expect(basicDeductionResidentTax(25_000_001)).toBe(0);
  });
});

describe('丸め（切捨て）が効いている', () => {
  it('課税標準は1,000円未満・税額は100円未満を切り捨てる', () => {
    const r = pensionNet({ annualPension: 2_556_000 });
    // 雑所得1,456,000 − 基礎控除880,000 ＝ 576,000（1,000円の倍数）→ 5%＝28,800 → ×1.021＝29,404.8
    expect(r.miscIncome).toBe(1_456_000);
    expect(r.incomeTax).toBe(29_400); // 100円未満切捨（29,404.8 → 29,400）
    expect(r.incomeTax % 100).toBe(0);
    expect(r.residentLevy % 100).toBe(0);
  });

  it('復興特別所得税が乗っている（所得税の2.1%分だけ大きい）', () => {
    const r = pensionNet({ annualPension: 3_312_000 });
    // 課税標準1,329,000 → 5%＝66,450 → ×1.021＝67,845.45 → 67,800
    expect(r.incomeTax).toBe(67_800);
    expect(r.incomeTax).toBeGreaterThan(66_450);
  });
});

describe('自治体で変わる部分が引数として効いている', () => {
  it('均等割は合計所得金額が非課税限度額以下なら課されない（地方税法295条3項）', () => {
    // 雑所得がちょうど45万円 / 45万1円 になる年金収入で境界を見る
    const atLimit = pensionNet({ annualPension: 1_100_000 + 450_000 });
    const overLimit = pensionNet({ annualPension: 1_100_000 + 450_001 });
    expect(atLimit.miscIncome).toBe(450_000);
    expect(atLimit.residentPerCapita).toBe(0);
    expect(overLimit.residentPerCapita).toBe(RESIDENT_TAX.perCapita);
  });

  it('均等割の額と非課税限度額は引数で差し替えられる（超過課税・級地区分のため）', () => {
    const custom = pensionNet({ annualPension: 1_800_000, residentPerCapita: 6_000 });
    expect(custom.residentPerCapita).toBe(6_000);
    const wider = pensionNet({ annualPension: 1_800_000, residentExemptionLimit: 800_000 });
    expect(wider.residentPerCapita).toBe(0);
  });

  it('社会保険料は手取りを減らすと同時に社会保険料控除として税も減らす', () => {
    const none = pensionNet({ annualPension: 2_556_000 });
    const withSocial = pensionNet({ annualPension: 2_556_000, socialInsurance: 200_000 });
    expect(withSocial.totalTax).toBeLessThan(none.totalTax);
    // 手取りの減りは社会保険料そのものより小さい（税が軽くなる分だけ戻る）
    expect(none.net - withSocial.net).toBeLessThan(200_000);
    expect(withSocial.net).toBe(2_556_000 - withSocial.totalTax - 200_000);
  });

  it('異常入力（負・NaN・Infinity）は0として扱う', () => {
    for (const bad of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
      const r = pensionNet({ annualPension: bad, socialInsurance: bad, otherIncome: bad });
      expect(r.gross).toBe(0);
      expect(r.net).toBe(0);
      expect(r.totalTax).toBe(0);
    }
  });
});

describe('繰上げ受給の年齢差（65歳未満の期間を取り違えていない）', () => {
  it('60歳開始は60〜64歳が65歳未満の控除、65歳以降が65歳以上の控除になる', () => {
    const under = annualNetAt(BASE, 60, 60);
    const over = annualNetAt(BASE, 60, 65);
    expect(under.gross).toBe(over.gross); // 額面は同じ
    expect(under.pensionDeduction).toBeLessThan(over.pensionDeduction); // 控除だけ違う
    expect(under.net).toBeLessThan(over.net); // → 65歳未満のほうが手取りが少ない
  });

  it('65歳になるまでの累計手取りは、65歳未満の手取り×5年ぶん', () => {
    expect(cumulativeNetPension(BASE, 60, 65)).toBe(annualNetAt(BASE, 60, 60).net * 5);
  });

  it('65歳以降に開始するケースでは65歳前の受給がない', () => {
    expect(cumulativeNetPension(BASE, 70, 65)).toBe(0);
    expect(breakEvenAgeVs65Net(BASE, 70).netBefore65).toBe(0);
  });
});

describe('手取りの損益分岐は額面より必ず後ろにずれる', () => {
  it('繰下げ（66〜75歳）はすべて、手取りの分岐が額面の分岐より遅い', () => {
    for (let age = 66; age <= 75; age += 1) {
      const gross = breakEvenAgeVs65(age).ageYears!;
      const net = breakEvenAgeVs65Net(BASE, age).ageYears!;
      expect(net).toBeGreaterThan(gross);
    }
  });

  it('手取りの増加率は額面の増加率より小さい（繰下げ）', () => {
    const n65 = annualNetAt(BASE, 65, 65).net;
    for (const age of [70, 75]) {
      const grossRatio = monthlyPension(BASE, age) / BASE;
      const netRatio = annualNetAt(BASE, age, 65).net / n65;
      expect(netRatio).toBeLessThan(grossRatio);
    }
  });

  it('額面が増えるほど手取り率は下がる（累進と控除の頭打ち）', () => {
    const ratios = [65, 70, 75].map((a) => annualNetAt(BASE, a, 65).netRatio);
    expect(ratios[0]!).toBeGreaterThan(ratios[1]!);
    expect(ratios[1]!).toBeGreaterThan(ratios[2]!);
  });
});

describe('画面表示用のまとめ（netScenario）', () => {
  it('繰上げは65歳前後で手取りが変わることを differsBefore65 で示す', () => {
    const s = netScenario(BASE, 60);
    expect(s.differsBefore65).toBe(true);
    expect(s.atStart.net).toBeLessThan(s.from65.net);
    expect(s.atStart.pensionDeduction).toBeLessThan(s.from65.pensionDeduction);
  });

  it('65歳以降に開始するケースでは65歳前後の差がない', () => {
    for (const age of [65, 70, 75]) {
      const s = netScenario(BASE, age);
      expect(s.differsBefore65).toBe(false);
      expect(s.atStart.net).toBe(s.from65.net);
    }
  });

  it('保険料の定額部分は損益分岐を「早める」（税とは逆向き）', () => {
    // 定額は年金が少ない65歳受給に相対的に重く効くので、繰下げが有利に見える方向へ動く。
    // 「保険料を入れると分岐がさらに後ろへずれる」と書きたくなるが、それは誤り。
    for (const age of [70, 75]) {
      const bare = netScenario(BASE, age);
      const flat = netScenario(BASE, age, { socialInsurance: 200_000 });
      expect(flat.from65.net).toBeLessThan(bare.from65.net);
      expect(flat.breakEven.ageYears!).toBeLessThan(bare.breakEven.ageYears! - 1);
    }
  });

  it('保険料の所得比例部分は損益分岐にほとんど影響しない（向きも一定しない）', () => {
    // 比例部分は率としては中立で、残る効果は社会保険料控除による税の軽減だけ。
    // その効果は小さく、年齢によって符号も変わる（70歳は早まり75歳は遅れる）。
    // ＝ 保険料込みの分岐が前後どちらへ動くかは自治体の料率構成しだいで決まらない。
    const deltas = [70, 75].map(
      (age) =>
        netScenario(BASE, age, { socialInsuranceRate: 0.08 }).breakEven.ageYears! -
        netScenario(BASE, age).breakEven.ageYears!,
    );
    for (const d of deltas) expect(Math.abs(d)).toBeLessThan(0.15);
    expect(Math.sign(deltas[0]!)).not.toBe(Math.sign(deltas[1]!));
  });

  it('税は逆に、損益分岐を「遅らせる」方向に働く', () => {
    // 累進と控除の頭打ちで手取り率が下がるため。保険料と向きが逆であることの対比。
    for (const age of [70, 75]) {
      expect(breakEvenAgeVs65Net(BASE, age).ageYears!).toBeGreaterThan(
        breakEvenAgeVs65(age).ageYears!,
      );
    }
  });

  it('65歳開始は損益分岐が存在しない（基準そのもの）', () => {
    expect(netScenario(BASE, 65).breakEven.ageYears).toBeNull();
  });
});

describe('記事 nenkin-kurisage-tesudori（D12）の数値が実装と一致している', () => {
  const body = (() => {
    const a = getArticle('nenkin-kurisage-tesudori');
    if (!a) throw new Error('article not found');
    return [
      a.title,
      a.description,
      a.lead,
      ...a.sections.flatMap((s) => [s.heading ?? '', ...s.paragraphs, ...(s.bullets ?? [])]),
      ...(a.faqs ?? []).flatMap((f) => [f.question, f.answer]),
    ].join('\n');
  })();

  const yen = (n: number): string => n.toLocaleString('en-US');
  /** 本文中に「その文字列」が現れる回数（重複掲載の見落とし防止）。 */
  const occurrences = (needle: string): number =>
    body.split(needle).length - 1;

  const net = (age: number) => annualNetAt(BASE, age, 65);
  const n65 = net(65);
  const n70 = net(70);
  const n75 = net(75);

  it('65/70/75歳の手取り年額を、額面と対にして載せている', () => {
    for (const [age, r] of [[65, n65], [70, n70], [75, n75]] as const) {
      expect(body).toContain(
        `${age}歳受給：額面 年${yen(r.gross)}円 → 手取り 年${yen(r.net)}円（税 ${yen(r.totalTax)}円）`,
      );
    }
  });

  it('手取りの増加率と額面の増加率を、両方そのまま載せている', () => {
    const pct = (r: number) => (Math.round((r - 1) * 1000) / 10).toFixed(1);
    const g70 = Math.round((monthlyPension(BASE, 70) / BASE - 1) * 100);
    const g75 = Math.round((monthlyPension(BASE, 75) / BASE - 1) * 100);
    expect(body).toContain(
      `70歳まで繰り下げると額面は+${g70}%ですが、手取りでは+${pct(n70.net / n65.net)}%にとどまります`,
    );
    expect(body).toContain(
      `75歳では額面+${g75}%に対して手取りは+${pct(n75.net / n65.net)}%です`,
    );
  });

  it('手取りベースの損益分岐を、額面の分岐と対にして載せている', () => {
    for (const age of [60, 70, 75]) {
      const g = breakEvenAgeVs65(age);
      const n = breakEvenAgeVs65Net(BASE, age);
      expect(body).toContain(
        `${age}歳開始：額面 ${g.years}歳${g.months}か月 → 手取り ${n.years}歳${n.months}か月`,
      );
    }
  });

  it('繰上げが住民税非課税に収まることを、実額つきで載せている', () => {
    const early = net(60);
    expect(early.totalTax).toBe(0); // 前提が崩れたら本文も直す
    expect(body).toContain(
      `60歳に繰り上げた場合の年金は年${yen(early.gross)}円。65歳以降は雑所得が${yen(early.miscIncome)}円となり`,
    );
  });

  it('額面の年額は本文のどこに出てきても実装と一致している', () => {
    // 同じ数字が本文・箇条書き・FAQ に重複して載るため、全出現をまとめて検査する。
    for (const age of [65, 70, 75]) {
      const s = pensionScenario(BASE, age);
      const stale = new RegExp(`${age}歳[^\\n]*?年([0-9,]+)円`, 'g');
      for (const m of body.matchAll(stale)) {
        const v = Number(m[1]!.replace(/,/g, ''));
        // 「年◯円」として現れる額は 額面 か 手取り か 税額 のいずれかでなければならない
        const r = net(age);
        expect([s.annual, r.net, r.totalTax, r.gross]).toContain(v);
      }
    }
  });

  it('本文に出るすべての「◯歳◯か月」が、実装が出す損益分岐と一致する', () => {
    // 同じ分岐年齢が箇条書きと FAQ の両方に載る。片方だけ直して片方が古いまま、
    // という取りこぼしを防ぐため toContain ではなく全出現を集合で照合する。
    const allowed = new Set(
      [60, 70, 75].flatMap((age) => {
        const g = breakEvenAgeVs65(age);
        const n = breakEvenAgeVs65Net(BASE, age);
        return [`${g.years}歳${g.months}か月`, `${n.years}歳${n.months}か月`];
      }),
    );
    const found = [...body.matchAll(/\d+歳\d+か月/g)].map((m) => m[0]!);
    expect(found.length).toBeGreaterThanOrEqual(6);
    for (const f of found) expect([...allowed]).toContain(f);
  });

  it('本文に出るすべての「％」が、実装が出す率と一致する', () => {
    const pct1 = (r: number) => (Math.round(r * 1000) / 10).toFixed(1);
    const allowed = new Set<string>();
    for (const age of [65, 70, 75]) {
      // 受給率（142% など）と手取り率（94.6% など）
      allowed.add(`${Math.round(pensionScenario(BASE, age).rate * 100)}%`);
      allowed.add(`${pct1(net(age).netRatio)}%`);
      if (age !== 65) {
        // 額面の増加率と手取りの増加率
        allowed.add(`+${Math.round((monthlyPension(BASE, age) / BASE - 1) * 100)}%`);
        allowed.add(`+${pct1(net(age).net / n65.net - 1)}%`);
      }
    }
    const found = [...body.matchAll(/\+?\d+(?:\.\d+)?%/g)].map((m) => m[0]!);
    expect(found.length).toBeGreaterThanOrEqual(9);
    for (const f of found) expect([...allowed]).toContain(f);
  });

  it('定量化を避けた古い言い回しが残っていない', () => {
    expect(occurrences('一律には示せません')).toBe(0);
    expect(occurrences('というイメージです')).toBe(0);
  });

  it('レンダラが解釈しない markdown 記法が残っていない', () => {
    expect(body).not.toContain('**');
  });
});
