/**
 * 賞与（ボーナス）の手取り額を概算する計算ロジック（E14）。
 *
 * 給与（calculations.ts）は年収を12で割った概算だが、賞与は算定の土台が別で、
 * 「標準賞与額（1,000円未満切捨）」に上限を当ててから料率を掛ける。所得税も
 * 月額表ではなく「賞与に対する源泉徴収税額の算出率の表」を使い、住民税は
 * 賞与から徴収されない。この差分を calc と同じ純関数として厳密化する。
 *
 * ─────────────────────────────────────────────────────────────
 *  法的根拠・料率の出典（最終確認日: 2026-08-16）
 * ─────────────────────────────────────────────────────────────
 *  【標準賞与額】税引き前の総支給額の1,000円未満切捨
 *  - 健康保険法第45条第1項: 年度累計573万円が上限（年度＝4月1日〜翌年3月31日）
 *      https://laws.e-gov.go.jp/api/1/lawdata/211AC0000000070
 *  - 厚生年金保険法第24条の4第1項: 「その月における標準賞与額」150万円が上限
 *      https://laws.e-gov.go.jp/api/1/lawdata/329AC0000000115
 *  - 日本年金機構「従業員に賞与を支給したときの手続き」
 *      https://www.nenkin.go.jp/service/kounen/hokenryo/hoshu/20141203.html
 *    ※上限は「その月に受けた賞与額」に対して働く。同一月内に2回以上支給する場合は
 *      合算してから1,000円未満を切り捨てる（各回を個別に切り捨てるのは誤り）。
 *  【社会保険料（従業員負担）】協会けんぽ・一般の事業・令和8年度
 *  - 健康保険 全国平均9.90% → 従業員4.95%（健康保険法第161条第1項で労使折半）
 *  - 介護保険（40〜64歳）1.62%・全国一律（令和8年3月分〜）→ 従業員0.81%
 *  - 厚生年金 18.30%（厚生年金保険法第81条第4項・平成29年9月以後据置）→ 従業員9.15%
 *  - 子ども・子育て支援金 0.23%（令和8年4月分〜）→ 従業員0.115%
 *      https://www.kyoukaikenpo.or.jp/assets/R8_13tokyo.pdf
 *  - 雇用保険 労働者負担0.5%（一般の事業・令和8年度）。労働保険徴収法第2条第2項が
 *    賞与を「賃金」に含め、上限規定はない（＝標準賞与額ではなく賞与の実額が基礎）
 *      https://www.mhlw.go.jp/content/001692566.pdf
 *  - 端数処理: 給与・賞与から控除する場合「50銭以下は切捨・50銭を超える場合は切上」
 *    （協会けんぽ 保険料額表 注記①）。全額を丸めず、折半してから円に丸める。
 *  【健保・介護・支援金は「1本の保険料額」であって3本ではない】
 *  - 健康保険法第156条第1項第1号: 保険料額＝「一般保険料等額（標準賞与額に一般保険料率と
 *    子ども・子育て支援金率とを合算した率を乗じて得た額）と介護保険料額との合算額」
 *  - 健康保険法第161条第1項:「被保険者及び…事業主は、それぞれ保険料額の二分の一を負担する」
 *    ＝ 標準賞与額 ×(9.90%＋0.23%＋1.62%) を求めてから折半し、円への丸めは **1回だけ** 行う。
 *    健保・介護・支援金をそれぞれ折半して個別に丸めると法定額から1円ずれる
 *    （実測: 標準賞与額0〜573万円の全域で、40〜64歳の40%・40歳未満の25%が1円過小）。
 *  - 裏取り: 令和8年度 協会けんぽ 東京の保険料額表には介護保険の独立した列が無く、
 *    「介護保険第２号被保険者に該当する場合」の合算列（11.47%）に折半額が1つ載るだけ。
 *  - したがって本ファイルの healthInsurance / nursingInsurance / childCareSupportLevy は
 *    **1本の法定保険料額を表示用に分解した内訳**であり、それぞれが法定の保険料額ではない
 *    （分解規則は apportionHealthGroup の JSDoc を参照）。
 *  - 一方 厚生年金（月150万円上限）と雇用保険（標準賞与額ではなく実額が基礎）は
 *    根拠条文も算定基礎も別なので、合算せず個別に丸める。
 *  【所得税】賞与に対する源泉徴収税額の算出率の表（令和8年分・甲欄）
 *  - 平成24年3月31日財務省告示第115号別表第三（令和7年4月30日財務省告示第122号改正）
 *      https://www.nta.go.jp/publication/pamph/gensen/zeigakuhyo2026/data/15-16.pdf
 *  - 国税庁 タックスアンサー No.2523（賞与に対する源泉徴収）
 *      https://www.nta.go.jp/taxes/shiraberu/taxanswer/gensen/2523.htm
 *    ※表の率は復興特別所得税（2.1%）込み（例: 2.042＝2×1.021）。再度1.021を掛けない。
 *    ※税額は1円未満切捨（国税庁の計算例で確認）。10円未満四捨五入は行わない。
 *  【住民税】賞与からは徴収しない（地方税法第321条の5第1項）
 *  - 特別徴収は前年所得で決まる年税額の1/12を6月〜翌年5月に毎月徴収するもので、
 *    賞与の支給によって追加徴収は発生しない。賞与は翌年度の住民税に反映される。
 *
 *  ※料率は毎年改定される。健康保険料率は本来 都道府県単位（令和8年度は新潟9.21%〜
 *    佐賀10.55%）で、健康保険組合はさらに別料率のため、本ツールは全国平均による概算。
 *  ※料率・上限は rates.ts が単一の正で、給与側（calculations.ts）も同じ定数を import する。
 *    ここに料率のリテラルを書かないこと（片側だけ古くなる drift の再発防止）。
 */
import { clampNonNeg, floorTo1000 } from "./calculations";
import { RATE_EMP_P100K, BONUS_CAP } from "./rates";

/** ユーザー入力 */
export interface BonusNetPayInput {
  /** 賞与の額面（税引き前の総支給額・円）。同一月内に2回以上支給する場合は合算額を渡す */
  bonusAmount: number;
  /** 前月の給与等の金額（賞与を除く・社会保険料控除後・円）。源泉徴収税率の行の決定に使う */
  previousMonthSalary: number;
  /** 40歳以上65歳未満か（介護保険料の対象） */
  isOver40: boolean;
  /** 扶養親族等の数。本ツールは0人のみ対応（0以外は例外を投げる） */
  dependents?: number;
  /** その年度（4/1〜3/31）に決定済みの標準賞与額の累計（円）。健保等の573万円上限に使う */
  fiscalYearHealthBonusTotal?: number;
}

/** 計算結果（内訳つき・すべて当該賞与1回分の円） */
export interface BonusNetPayResult {
  /** 標準賞与額（賞与額の1,000円未満切捨・上限適用前） */
  standardBonus: number;
  /** 健保・介護・支援金の算定基礎（年度累計573万円の上限適用後） */
  standardBonusHealth: number;
  /** 厚生年金の算定基礎（月150万円の上限適用後） */
  standardBonusPension: number;
  /**
   * 健康保険料（従業員負担）。
   * ※健保法156条1項1号の保険料額は健保＋支援金＋介護の合算1本なので、この値は
   *   healthNursingChildCareTotal を表示用に分解した内訳であり、単独の法定額ではない。
   */
  healthInsurance: number;
  /** 介護保険料（従業員負担・40〜64歳のみ）。healthInsurance と同じく表示用の内訳 */
  nursingInsurance: number;
  /** 厚生年金保険料（従業員負担・単独で法定の額） */
  pensionInsurance: number;
  /** 子ども・子育て支援金（従業員負担・令和8年4月分〜）。表示用の内訳 */
  childCareSupportLevy: number;
  /**
   * 健保・介護・支援金の法定保険料額（従業員負担・合算率で1回だけ丸めた値）。
   * ＝ healthInsurance + nursingInsurance + childCareSupportLevy（常に一致する）
   */
  healthNursingChildCareTotal: number;
  /** 雇用保険料（労働者負担・上限なし・賞与の実額が基礎） */
  employmentInsurance: number;
  /** 社会保険料合計（従業員負担） */
  socialInsurance: number;
  /** 源泉徴収税率（%・復興特別所得税込み。例: 6.126） */
  withholdingRate: number;
  /** 所得税（復興特別所得税を含む・1円未満切捨） */
  incomeTax: number;
  /** 住民税（賞与からは徴収されないため常に0） */
  residentTax: number;
  /** 控除合計（＝賞与額面 − 手取り） */
  totalDeduction: number;
  /** 手取り額 */
  takeHome: number;
  /** 手取り率（手取り ÷ 賞与額面） */
  takeHomeRate: number;
  /** この賞与を加えた後の年度累計標準賞与額（次回呼び出しにそのまま渡せる） */
  fiscalYearHealthBonusTotalAfter: number;
}

// ── 料率・上限（rates.ts が単一の正。給与側 calculations.ts と同じ定数を使う）──
// 端数処理を厳密に行うため、従業員負担率は「10万分率の整数」のまま整数演算する
// （0.0495 のような浮動小数点を掛けると、ちょうど50銭の判定が誤差で狂うため）。
const KENKO_RATE_EMP_P100K = RATE_EMP_P100K.health; // 健康保険 従業員負担4.95%
const KAIGO_RATE_EMP_P100K = RATE_EMP_P100K.nursing; // 介護保険 従業員負担0.81%
const KOSEI_RATE_EMP_P100K = RATE_EMP_P100K.pension; // 厚生年金 従業員負担9.15%
const KODOMO_RATE_EMP_P100K = RATE_EMP_P100K.childCare; // 子ども・子育て支援金 従業員負担0.115%
const KOYO_RATE_EMP_P100K = RATE_EMP_P100K.employment; // 雇用保険 労働者負担0.5%
const KENKO_BONUS_FY_CAP = BONUS_CAP.healthFiscalYear; // 健保・介護・支援金 年度累計上限573万円
const KOSEI_BONUS_MONTHLY_CAP = BONUS_CAP.pensionMonthly; // 厚年 標準賞与額の月間上限150万円

/**
 * 従業員負担額を円に丸める。賞与から控除する場合の端数処理は
 * 「50銭以下は切捨・50銭を超える場合は切上」（協会けんぽ 保険料額表 注記①）。
 * JavaScript の Math.round はちょうど0.5を切り上げるため1円ずれる（標準賞与額は
 * 必ず1,000円の倍数なので、ちょうど50銭は現実に頻発する）。
 * @param base 算定基礎（円・整数）
 * @param ratePer100k 従業員負担率（10万分率の整数）
 */
const employeeShareYen = (base: number, ratePer100k: number): number => {
  const scaled = base * ratePer100k; // ＝ 負担額 × 100,000（整数のまま扱い誤差を出さない）
  const yen = Math.floor(scaled / 100_000);
  const frac = scaled - yen * 100_000; // 1円未満の端数（10万分率）
  return frac * 2 > 100_000 ? yen + 1 : yen; // ちょうど50銭（frac*2 === 100,000）は切捨
};

/**
 * 健保・介護・支援金の従業員負担額を「合算率で1回だけ丸めて」求め、表示用の内訳へ按分する。
 *
 * 【なぜ1回か】健康保険法第156条第1項第1号は、健康保険・子ども・子育て支援金・介護保険を
 * 合算した1つの「保険料額」を定義し、第161条第1項がその二分の一を被保険者負担とする。
 * 保険料額は1つなので、協会けんぽの端数規則（50銭以下切捨・50銭超切上）が働くのも1回だけ。
 * 3つを個別に丸めると法定額から1円ずれる（例: 標準賞与額601,000円・40歳以上は
 * 個別丸めで35,308円、法定どおりだと 601,000×11.75%÷2＝35,308.75 → 35,309円）。
 *
 * 【按分規則（最大剰余法・display decomposition）】
 * 返す3つの内訳は法定の保険料額ではなく、1本の法定額を表示用に割り付けたものである。
 *  1. 各内訳の厳密額（標準賞与額 × 各従業員負担率）の1円未満を切り捨てる。
 *  2. 合算額（1回だけ丸めた法定額）と切捨合計の差を、
 *     切り捨てた端数の大きい順に1円ずつ配る（差は内訳数を超えず、本ファイルの料率では0〜2円）。
 *  3. 端数が同値のときは宣言順（健保 → 介護 → 支援金）を優先する。
 * この規則は (a) 内訳の合計が必ず法定額に一致し、(b) 各内訳が厳密額から1円以上離れず、
 * (c) 入力が同じなら常に同じ結果になる（決定的）という3条件を満たす。
 * 率が0の内訳（40歳未満の介護保険）は端数も0になるため、按分で1円を受け取ることはない
 * （配る枚数は端数が正の内訳の数を超えないため）。
 *
 * @param base 算定基礎＝上限適用後の標準賞与額（円・整数。健保・介護・支援金で共通）
 * @param ratesPer100k 各内訳の従業員負担率（10万分率の整数・健保/介護/支援金の順）
 * @returns parts 表示用の内訳（ratesPer100k と同順）／ total 法定の合算保険料額
 */
const apportionHealthGroup = (
  base: number,
  ratesPer100k: readonly [number, number, number],
): { parts: [number, number, number]; total: number } => {
  const combinedRate = ratesPer100k.reduce((a, b) => a + b, 0);
  const total = employeeShareYen(base, combinedRate); // 法定額（丸めはここ1回だけ）

  const scaled = ratesPer100k.map((r) => base * r); // 各内訳 × 100,000
  const parts = scaled.map((s) => Math.floor(s / 100_000)) as [number, number, number];
  const fracs = scaled.map((s, i) => s - parts[i] * 100_000);

  // 端数の大きい順（同値は宣言順）に、合算額との差を1円ずつ配る
  let residual = total - parts.reduce((a, b) => a + b, 0);
  const order = fracs.map((frac, i) => ({ i, frac })).sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (const { i } of order) {
    if (residual <= 0) break;
    parts[i] += 1;
    residual -= 1;
  }
  return { parts, total };
};

/**
 * 賞与に対する源泉徴収税額の算出率の表（令和8年分・甲欄・扶養親族等の数0人）。
 * [前月の社会保険料等控除後の給与等の金額（円・以上）, 率（%×1,000の整数）]。
 * 上限は次の行の下限（未満）＝「以上」はその額を含み「未満」は含まない（国税庁）。
 * 率は復興特別所得税込み。令和7年分は境界額が異なる（本ツールは令和8年分のみ実装）。
 */
const BONUS_RATE_TABLE_R8_KOU_0: readonly (readonly [number, number])[] = [
  [0, 0],
  [82_000, 2_042],
  [94_000, 4_084],
  [260_000, 6_126],
  [309_000, 8_168],
  [342_000, 10_210],
  [372_000, 12_252],
  [402_000, 14_294],
  [433_000, 16_336],
  [520_000, 18_378],
  [605_000, 20_420],
  [684_000, 22_462],
  [715_000, 24_504],
  [752_000, 26_546],
  [795_000, 28_588],
  [854_000, 30_630],
  [922_000, 32_672],
  [1_318_000, 35_735],
  [1_521_000, 38_798],
  [2_621_000, 41_861],
  [3_495_000, 45_945],
];

/**
 * 扶養親族等の数の対応範囲チェック。
 * 本ツールは一次資料で全行を検証できた「0人」の列のみ実装する。1人以上の列は
 * 数値を推測して配信しないため例外にする（拡張時は令和8年分の表を再取得すること）。
 * ※「扶養親族等の数」は単純な扶養人数ではなく、障害者・寡婦・ひとり親・勤労学生に
 *   該当する場合は各1人を加算する（告示別表第三 備考2）。0人＝これらに全て非該当。
 */
const assertSupportedDependents = (dependents: number): number => {
  if (dependents === 0) return 0;
  throw new Error(
    "扶養親族等の数は0人のみ対応しています（1人以上の列は未検証のため実装していません）。",
  );
};

/**
 * 賞与の社会保険料（従業員負担）を求める。
 * 健保・介護・支援金は年度累計573万円、厚年は月150万円で算定基礎を打ち切る。
 * 雇用保険だけは上限も標準賞与額もなく、賞与の実額に料率を掛ける（徴収法第11条第1項）。
 *
 * 丸めの単位は「法定の保険料額」ごとに1回:
 *  - health + nursing + childCare … 健保法156条1項1号の合算1本（＝healthGroupTotal）。
 *    返り値の health / nursing / childCare はその表示用の内訳（apportionHealthGroup 参照）。
 *  - pension … 厚年法81条（算定基礎が月150万円上限で別）
 *  - employment … 徴収法（算定基礎が標準賞与額ではなく賞与の実額で別）
 * @param bonusAmount 賞与の額面（同一月内の合計額・円）
 * @param isOver40 介護保険（40歳以上65歳未満）
 * @param fiscalYearHealthBonusTotal 年度内に決定済みの標準賞与額の累計（円）
 */
export function bonusSocialInsurance(
  bonusAmount: number,
  isOver40: boolean,
  fiscalYearHealthBonusTotal = 0,
) {
  const bonus = Math.floor(clampNonNeg(bonusAmount));
  const fyTotal = Math.floor(clampNonNeg(fiscalYearHealthBonusTotal));

  const standardBonus = floorTo1000(bonus);
  // 健保等: 年度累計が573万円に達した時点で、その月は差分のみ、以降の月は0になる
  const standardBonusHealth = Math.max(0, Math.min(standardBonus, KENKO_BONUS_FY_CAP - fyTotal));
  // 厚年: 月ごとにリセットされる上限（年度累計はしない）
  const standardBonusPension = Math.min(standardBonus, KOSEI_BONUS_MONTHLY_CAP);

  // 健保・介護・支援金は健保法156条1項1号の「1つの保険料額」。合算率で1回だけ丸め、
  // 表示用の内訳へ按分する（個別に丸めると法定額から最大2円ずれる）。
  const { parts: healthGroup, total: healthGroupTotal } = apportionHealthGroup(standardBonusHealth, [
    KENKO_RATE_EMP_P100K,
    isOver40 ? KAIGO_RATE_EMP_P100K : 0,
    KODOMO_RATE_EMP_P100K,
  ]);
  const [health, nursing, childCare] = healthGroup;
  // 厚年・雇用保険は根拠条文も算定基礎も別なので、合算せず個別に丸める
  const pension = employeeShareYen(standardBonusPension, KOSEI_RATE_EMP_P100K);
  const employment = employeeShareYen(bonus, KOYO_RATE_EMP_P100K);

  return {
    standardBonus,
    standardBonusHealth,
    standardBonusPension,
    health,
    nursing,
    pension,
    childCare,
    employment,
    /** 健保・介護・支援金の法定合算額（＝health + nursing + childCare。按分前の丸め済み値） */
    healthGroupTotal,
    total: healthGroupTotal + pension + employment,
  };
}

/**
 * 賞与に対する源泉徴収税率（%・復興特別所得税込み）を返す。令和8年分・甲欄。
 * 行は「前月の給与等（賞与を除く）− 前月の社会保険料等」で決まり、率を掛ける相手は
 * 「その賞与 − 賞与の社会保険料等」という別の金額である点に注意（告示別表第三 備考1）。
 * @param previousMonthSalary 前月の社会保険料等控除後の給与等の金額（円）
 * @param dependents 扶養親族等の数（0のみ対応）
 */
export function bonusWithholdingRate(previousMonthSalary: number, dependents = 0): number {
  assertSupportedDependents(dependents);
  const prevNet = Math.floor(clampNonNeg(previousMonthSalary));
  let rate = 0;
  for (const [min, r] of BONUS_RATE_TABLE_R8_KOU_0) {
    if (prevNet >= min) rate = r;
    else break;
  }
  return rate / 1000;
}

/**
 * 「算出率の表」を使えず月額表による計算が必要なケースか判定する（告示別表第三 備考4）。
 * ①前月に給与の支払がない ②前月の給与が前月の社会保険料以下（＝控除後が0以下）
 * ③賞与（社会保険料控除後）が前月の給与（社会保険料控除後）の10倍を超える
 * この3ケースは月額表を用いた別計算になるが、月額表は本ツールに未実装のため、
 * calculateBonusNetPay は誤った税額を返さず例外を投げる（呼び出し側で対象外と案内する）。
 */
export function requiresMonthlyTableMethod(input: BonusNetPayInput): boolean {
  const bonus = Math.floor(clampNonNeg(input.bonusAmount));
  const prevNet = Math.floor(clampNonNeg(input.previousMonthSalary));
  const si = bonusSocialInsurance(bonus, input.isOver40, input.fiscalYearHealthBonusTotal);
  return needsMonthlyTable(prevNet, Math.max(0, bonus - si.total));
}

/** 備考4の3トリガー判定（率表と本関数で二重定義しないための共通部）。 */
const needsMonthlyTable = (prevNet: number, bonusAfterSi: number): boolean => {
  if (bonusAfterSi === 0) return false; // 課税対象が無く、どちらの方法でも税額0
  return prevNet <= 0 || bonusAfterSi > prevNet * 10;
};

/**
 * 賞与の額面から手取り額を概算する（メイン関数）。
 *
 * 手順: 標準賞与額（1,000円未満切捨）→ 上限適用 → 社会保険料 → 賞与の額面から
 * 社会保険料を引いた額に源泉徴収税率を掛けて所得税（1円未満切捨）→ 手取り。
 * 住民税は賞与から徴収されないため0。
 *
 * ※以下は近似・単純化（calculations.ts と同じく明示する）:
 *  - 健康保険料率は全国平均9.90%。実際は都道府県単位（9.21〜10.55%）・健保組合は別料率。
 *  - 令和8年4月分以降の料率で固定。3月支給分は健保が新料率でも支援金は未適用のため、
 *    2026年3月の賞与はごくわずかに過大に見積もる。
 *  - 雇用保険料の円未満の端数処理は健保・厚年と同じ規則（50銭以下切捨）を当てている。
 *    労働局の一次資料では確認できていないため、この1円は概算。
 *  - 健保・介護・支援金の内訳表示は1本の法定保険料額の按分であり、内訳の1円単位は
 *    法定の区分ではない（合計は法定額と必ず一致する）。
 *  - 住民税0は地方税法第321条の5の構造（年税額の1/12を毎月徴収）からの帰結で、
 *    「賞与から徴収しない」と明記した条文があるわけではない。
 *  - 賞与の計算期間・複数事業所勤務・年度途中の資格取得喪失は考慮しない。
 * @throws 扶養親族等の数が0以外のとき／月額表による計算が必要なとき
 */
export function calculateBonusNetPay(input: BonusNetPayInput): BonusNetPayResult {
  assertSupportedDependents(input.dependents ?? 0);

  const bonus = Math.floor(clampNonNeg(input.bonusAmount));
  const prevNet = Math.floor(clampNonNeg(input.previousMonthSalary));
  const fyTotal = Math.floor(clampNonNeg(input.fiscalYearHealthBonusTotal ?? 0));

  const si = bonusSocialInsurance(bonus, input.isOver40, fyTotal);

  // 率を掛ける相手は「賞与 − 賞与から控除される社会保険料等」（告示別表第三 注2）
  const bonusAfterSi = Math.max(0, bonus - si.total);

  if (needsMonthlyTable(prevNet, bonusAfterSi)) {
    throw new Error(
      "前月の給与がない場合、または賞与が前月給与（社会保険料控除後）の10倍を超える場合は、" +
        "算出率の表ではなく月額表で計算します（本ツールは未対応）。",
    );
  }

  const withholdingRate = bonusWithholdingRate(prevNet);
  // 率は整数（%×1,000）に戻して整数演算し、1円未満を切り捨てる
  const rateThousandths = Math.round(withholdingRate * 1000);
  const incomeTax = Math.floor((bonusAfterSi * rateThousandths) / 100_000);
  const residentTax = 0;

  const totalDeduction = si.total + incomeTax + residentTax;
  const takeHome = bonus - totalDeduction;

  return {
    standardBonus: si.standardBonus,
    standardBonusHealth: si.standardBonusHealth,
    standardBonusPension: si.standardBonusPension,
    healthInsurance: si.health,
    nursingInsurance: si.nursing,
    pensionInsurance: si.pension,
    childCareSupportLevy: si.childCare,
    healthNursingChildCareTotal: si.healthGroupTotal,
    employmentInsurance: si.employment,
    socialInsurance: si.total,
    withholdingRate,
    incomeTax,
    residentTax,
    totalDeduction,
    takeHome,
    takeHomeRate: bonus > 0 ? takeHome / bonus : 0,
    fiscalYearHealthBonusTotalAfter: fyTotal + si.standardBonusHealth,
  };
}
