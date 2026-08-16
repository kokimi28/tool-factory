/**
 * 料率の単一の正（rates.ts）の回帰テスト。
 *
 * 目的は2つ:
 *  1. 一次資料で確認した令和8年度の料率を固定する（誤った改定を CI で落とす）。
 *  2. 給与（calculations.ts）と賞与（bonus.ts）が **同じ料率** で計算されることを、
 *     出力から逆算して確認する。かつて両者が料率を別々に持っていたため、賞与だけ
 *     令和8年度に更新され、給与は令和7年度＋雇用保険の誤値（0.6%）のまま残った。
 *     この drift は「記事が教える率」と「シミュレーターが使う率」の食い違いとして
 *     読者に届くので、符号ではなく実効料率そのものを突き合わせて防ぐ。
 *  3. **本文が書く料率**（記事・FAQ・ツールページの「4.95%」「0.5%」…）が rates.ts から
 *     導出した文字列と一致することを確認する。1と2はコード方向だけを見ていたため、
 *     本文の「賞与の額面の0.5%」を「0.6%」（＝rates.ts を作る原因になった雇用保険の
 *     誤値）に書き換えても全テストが green のままだった。改定時に rates.ts だけ更新して
 *     本文を置き去りにする事故も同じ穴なので、両方向を1か所で塞ぐ。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, it, expect } from "vitest";
import { RATE_EMP, RATE_EMP_P100K, MONTHLY_CAP, BONUS_CAP, RATES_CHECKED_AT } from "./rates";
import { socialInsurance, calculateNetSalary } from "./calculations";
import { bonusSocialInsurance, bonusWithholdingRate } from "./bonus";
import { getAllArticles } from "./articles";
import { FAQ_ITEMS } from "./faq";
import { SITE_DESCRIPTION } from "./site";

const repoRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const tedoriPageSource = readFileSync(
  join(repoRoot, "app", "(tools)", "tedori", "page.tsx"),
  "utf8",
);

describe("rates.ts — 令和8年度の従業員負担率（一次資料の確認値）", () => {
  it("協会けんぽ 令和8年度（全国平均9.90%／介護1.62%／支援金0.23%／厚年18.30%）の折半", () => {
    expect(RATE_EMP_P100K.health).toBe(4_950); // 9.90% ÷ 2
    expect(RATE_EMP_P100K.nursing).toBe(810); // 1.62% ÷ 2
    expect(RATE_EMP_P100K.pension).toBe(9_150); // 18.30% ÷ 2
    expect(RATE_EMP_P100K.childCare).toBe(115); // 0.23% ÷ 2
  });

  it("雇用保険 労働者負担は 5/1,000（令和8年度・一般の事業）", () => {
    // 令和7年度は 5.5/1,000。かつて実装されていた 0.6% はどちらの年度でも誤り。
    expect(RATE_EMP_P100K.employment).toBe(500);
    expect(RATE_EMP.employment).toBe(0.005);
    expect(RATE_EMP.employment).not.toBe(0.006);
  });

  it("標準報酬月額・標準賞与額の上限", () => {
    expect(MONTHLY_CAP.health).toBe(1_390_000); // 第50等級
    expect(MONTHLY_CAP.pension).toBe(650_000); // 第32等級
    expect(BONUS_CAP.healthFiscalYear).toBe(5_730_000); // 年度累計573万円
    expect(BONUS_CAP.pensionMonthly).toBe(1_500_000); // 月150万円
  });
});

describe("drift guard — 給与と賞与が同じ料率を使う", () => {
  // 上限に当たらない額を選び、実効料率（保険料 ÷ 算定基礎）を両者から逆算して比較する。
  const ANNUAL = 6_000_000; // 標準報酬月額の上限（健保139万/厚年65万）に当たらない年収
  const BONUS = 1_000_000; // 標準賞与額の上限（年度573万/月150万）に当たらない賞与

  const salary = socialInsurance(ANNUAL, true);
  const bonus = bonusSocialInsurance(BONUS, true);

  const effective = (amount: number, base: number) => Math.round((amount / base) * 100_000);

  it("健康保険・介護保険・厚生年金・雇用保険の実効料率が一致する", () => {
    expect(effective(salary.health, ANNUAL)).toBe(effective(bonus.health, BONUS));
    expect(effective(salary.nursing, ANNUAL)).toBe(effective(bonus.nursing, BONUS));
    expect(effective(salary.pension, ANNUAL)).toBe(effective(bonus.pension, BONUS));
    expect(effective(salary.employment, ANNUAL)).toBe(effective(bonus.employment, BONUS));
  });

  it("子ども・子育て支援金は給与側にも乗っている（令和8年4月分〜）", () => {
    // 給与側にこの項目が無い期間があり、賞与側だけが正しい状態になっていた。
    expect(salary.childCare).toBeGreaterThan(0);
    expect(effective(salary.childCare, ANNUAL)).toBe(effective(bonus.childCare, BONUS));
  });

  it("各実効料率は rates.ts の宣言値そのものと一致する", () => {
    expect(effective(salary.health, ANNUAL)).toBe(RATE_EMP_P100K.health);
    expect(effective(salary.nursing, ANNUAL)).toBe(RATE_EMP_P100K.nursing);
    expect(effective(salary.pension, ANNUAL)).toBe(RATE_EMP_P100K.pension);
    expect(effective(salary.childCare, ANNUAL)).toBe(RATE_EMP_P100K.childCare);
    expect(effective(salary.employment, ANNUAL)).toBe(RATE_EMP_P100K.employment);
  });
});

// ─────────────────────────────────────────────────────────────
//  prose lock — 本文が書く料率は rates.ts から組み立てた文字列で照合する
// ─────────────────────────────────────────────────────────────

/** 従業員負担率を本文の表記に戻す（10万分率 → "4.95%"）。出所は rates.ts だけ */
const empPct = (k: keyof typeof RATE_EMP_P100K, digits: number) =>
  `${(RATE_EMP_P100K[k] / 1000).toFixed(digits)}%`;
/** 労使合計（折半前）の料率表記（10万分率 ×2 → "9.90%"） */
const fullPct = (k: keyof typeof RATE_EMP_P100K, digits: number) =>
  `${((RATE_EMP_P100K[k] * 2) / 1000).toFixed(digits)}%`;
/** 復興特別所得税は賞与の算出率の表に織り込み済み（2.042 ＝ 2% × 1.021）。表から逆算する */
const SURTAX_MULTIPLIER = bonusWithholdingRate(82_000) / 2;
const surtaxPct = `${((SURTAX_MULTIPLIER - 1) * 100).toFixed(1)}%`; // "2.1%"

const articleBody = (slug: string) => {
  const a = getAllArticles().find((x) => x.slug === slug)!;
  expect(a, `記事 ${slug} が無い`).toBeDefined();
  return [a.title, a.description, ...a.sections.flatMap((s) => [s.heading ?? "", ...s.paragraphs])].join(
    "\n",
  );
};

describe("prose lock — 記事が書く料率は rates.ts から導出される", () => {
  it("tedori-shikumi §1 社会保険料の率（健保・厚年・雇用・支援金・介護）", () => {
    const body = articleBody("tedori-shikumi");
    expect(body).toContain(
      `従業員負担の率は、健康保険が${empPct("health", 2)}（協会けんぽ全国平均${fullPct("health", 2)}の労使折半）、厚生年金が${empPct("pension", 2)}、雇用保険が${empPct("employment", 1)}（一般の事業）です。さらに令和8年4月分からは子ども・子育て支援金${empPct("childCare", 3)}（${fullPct("childCare", 2)}の労使折半）が加わりました。`,
    );
    expect(body).toContain(`介護保険料（従業員負担 ${empPct("nursing", 2)}）`);
  });

  it("tedori-shikumi §2 復興特別所得税の率（賞与の算出率の表から逆算）", () => {
    expect(articleBody("tedori-shikumi")).toContain(
      `これに復興特別所得税（所得税額の${surtaxPct}）が上乗せされます。`,
    );
  });

  it("shakai-hoken-uchiwake-tedori §種類と率（5項目すべて）", () => {
    const body = articleBody("shakai-hoken-uchiwake-tedori");
    expect(body).toContain(
      `健康保険：協会けんぽの全国平均${fullPct("health", 2)}を労使折半し、従業員負担は${empPct("health", 2)}。`,
    );
    expect(body).toContain(
      `厚生年金：${fullPct("pension", 1)}を労使折半し、従業員負担は${empPct("pension", 2)}。`,
    );
    // 令和7年度の 0.55% は「引き下げられた前の率」なので history としてそのまま持つ。
    // 現行率だけが rates.ts 由来で、改定すればこの文は作れなくなる。
    expect(body).toContain(
      `雇用保険：従業員負担は${empPct("employment", 1)}（一般の事業・令和8年度）。`,
    );
    expect(body).toContain("令和7年度の0.55%から引き下げられました。");
    expect(empPct("employment", 2)).not.toBe("0.55%"); // 前年度の率が現行率と衝突していない
    expect(body).toContain(
      `子ども・子育て支援金：${fullPct("childCare", 2)}を労使折半し、従業員負担は${empPct("childCare", 3)}。`,
    );
    expect(body).toContain(
      `介護保険（40〜64歳のみ）：${fullPct("nursing", 2)}を労使折半し、従業員負担は${empPct("nursing", 2)}。`,
    );
  });

  it("gakumen-tedori-hayamihyo §注記と40歳以上の率", () => {
    const body = articleBody("gakumen-tedori-hayamihyo");
    expect(body).toContain(
      `令和8年度の協会けんぽ全国平均料率（健康保険${fullPct("health", 2)}・介護保険${fullPct("nursing", 2)}・子ども・子育て支援金${fullPct("childCare", 2)}）・厚生年金${fullPct("pension", 1)}・雇用保険料率（一般の事業）にもとづく概算です。`,
    );
    expect(body).toContain(
      `40歳から64歳は介護保険料（従業員負担 ${empPct("nursing", 2)}）が上乗せされます。`,
    );
  });

  it("標準報酬月額・標準賞与額の上限は本文でも rates.ts と一致する", () => {
    const shoyo = articleBody("shoyo-tedori");
    expect(shoyo).toContain(`${BONUS_CAP.pensionMonthly.toLocaleString("en-US")}円`);
    expect(shoyo).toContain(`${BONUS_CAP.healthFiscalYear.toLocaleString("en-US")}円`);
    expect(shoyo).toContain(`その月${BONUS_CAP.pensionMonthly / 10_000}万円`);
    expect(shoyo).toContain(`年度${BONUS_CAP.healthFiscalYear / 10_000}万円`);
  });
});

describe("prose lock — FAQ・ツールページが書く料率は rates.ts から導出される", () => {
  const faqText = FAQ_ITEMS.map((f) => `${f.question}\n${f.answer}`).join("\n");

  it("FAQ「年収からどれくらい引かれますか？」の5料率", () => {
    expect(faqText).toContain(
      `令和8年度の協会けんぽ全国平均で健康保険${empPct("health", 2)}＋厚生年金${empPct("pension", 2)}＋雇用保険${empPct("employment", 1)}＋子ども・子育て支援金${empPct("childCare", 3)}、40歳以上は介護保険${empPct("nursing", 2)}が加算`,
    );
  });

  it("FAQ「40歳になると手取りは減りますか？」の介護保険料率", () => {
    expect(faqText).toContain(
      `介護保険料（令和8年度は全国一律${fullPct("nursing", 2)}の労使折半で従業員負担${empPct("nursing", 2)}）`,
    );
  });

  it("/tedori ページの「手取りはどうやって計算する？」の5料率と復興特別所得税", () => {
    expect(tedoriPageSource).toContain(
      `健康保険（${empPct("health", 2)}）・厚生年金（${empPct("pension", 2)}）・雇用保険（${empPct("employment", 1)}）・子ども・子育て支援金（${empPct("childCare", 3)}）。40〜64歳は介護保険（${empPct("nursing", 2)}）も加算。`,
    );
    expect(tedoriPageSource).toContain(`復興特別所得税${surtaxPct}`);
  });
});

describe("prose lock — 天引き項目の列挙に子ども・子育て支援金が漏れていない（Defect 2）", () => {
  // calculateNetSalary は子ども・子育て支援金を控除しているのに、ツールページのリードと
  // SITE_DESCRIPTION（JSON-LD の WebApplication description ＝ 構造化データ）が
  // 「健康保険・厚生年金・雇用保険・介護保険」のままで、コードと矛盾していた。
  // 個別の文言ではなく「雇用保険と介護保険を同じ文で並べる列挙」という形で規約化する。
  const surfaces: Array<[string, string]> = [
    ["lib/tedori/site.ts SITE_DESCRIPTION", SITE_DESCRIPTION],
    ["app/(tools)/tedori/page.tsx", tedoriPageSource],
    ["lib/tedori/faq.ts", FAQ_ITEMS.map((f) => `${f.question}\n${f.answer}`).join("\n")],
    ...getAllArticles().map(
      (a) =>
        [
          `lib/tedori/articles.ts ${a.slug}`,
          [a.title, a.description, ...a.sections.flatMap((s) => [s.heading ?? "", ...s.paragraphs])].join(
            "\n",
          ),
        ] as [string, string],
    ),
  ];

  it("計算結果は子ども・子育て支援金を必ず含む（列挙の前提）", () => {
    expect(
      calculateNetSalary({ annualIncome: 5_000_000, isOver40: false }).childCareSupportLevy,
    ).toBeGreaterThan(0);
  });

  it("SITE_DESCRIPTION（構造化データ）が子ども・子育て支援金を明記する", () => {
    expect(SITE_DESCRIPTION).toContain("子ども・子育て支援金");
  });

  for (const [name, text] of surfaces) {
    it(`${name}: 雇用保険と介護保険を並べる列挙には子ども・子育て支援金も入る`, () => {
      for (const sentence of text.split("。")) {
        if (!sentence.includes("雇用保険") || !sentence.includes("介護保険")) continue;
        expect(sentence, `${name} の列挙に子ども・子育て支援金が無い: ${sentence.trim()}`).toContain(
          "子ども・子育て支援金",
        );
      }
    });
  }
});

describe("prose lock — 料率由来の数値を書く記事は RATES_CHECKED_AT 以降に更新されている", () => {
  // tedori-meyasu-nenshu だけが 2026-07-13 のまま取り残され、令和8年度の料率で
  // 再導出した兄弟記事（2026-08-16）と同じ入力に別の手取りを載せていた。
  // 「料率由来の数値を書いているか」を検出して、更新日の置き去りを CI で赤にする。
  const RATE_STRINGS = [
    empPct("health", 2),
    empPct("pension", 2),
    empPct("childCare", 3),
    empPct("nursing", 2),
    fullPct("health", 2),
    fullPct("nursing", 2),
    fullPct("childCare", 2),
  ];
  /** 現行ロジックで求めた手取り（円・万円・0.1万円の3表記）は「料率由来の数値」 */
  const TAKE_HOME_STRINGS = [
    2_000_000, 3_000_000, 4_000_000, 5_000_000, 6_000_000, 7_000_000, 8_000_000, 10_000_000,
    12_000_000, 15_000_000,
  ].flatMap((income) => {
    const t = calculateNetSalary({ annualIncome: income, isOver40: false }).takeHome;
    return [
      `${t.toLocaleString("en-US")}円`,
      `約${Math.round(t / 10_000)}万円`,
      `約${(Math.round(t / 1000) / 10).toFixed(1)}万円`,
    ];
  });
  const MARKERS = [...RATE_STRINGS, ...TAKE_HOME_STRINGS];

  for (const article of getAllArticles()) {
    const body = [
      article.description,
      ...article.sections.flatMap((s) => [s.heading ?? "", ...s.paragraphs]),
    ].join("\n");
    const marker = MARKERS.find((m) => body.includes(m));
    if (!marker) continue;
    it(`${article.slug}（「${marker}」を書いている）の updatedAt は ${RATES_CHECKED_AT} 以降`, () => {
      expect(
        article.updatedAt >= RATES_CHECKED_AT,
        `${article.slug} の updatedAt=${article.updatedAt} が料率確認日 ${RATES_CHECKED_AT} より古い`,
      ).toBe(true);
    });
  }

  it("この検出が空振りしていない（対象記事が複数ある）", () => {
    const covered = getAllArticles().filter((a) => {
      const body = [
        a.description,
        ...a.sections.flatMap((s) => [s.heading ?? "", ...s.paragraphs]),
      ].join("\n");
      return MARKERS.some((m) => body.includes(m));
    });
    expect(covered.length).toBeGreaterThanOrEqual(6);
    expect(covered.map((a) => a.slug)).toContain("tedori-meyasu-nenshu");
  });
});
