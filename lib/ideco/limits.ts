/**
 * iDeCo の拠出限度額（auto-backlog D9(a)）。
 *
 * このツールの既存 `calcIdecoSim` は**受取時**（一時金の退職所得控除・重複調整）専用で、
 * 拠出限度額はどこにもモデル化されていなかった。本ファイルがその欠けていた面を担う。
 *
 * ─────────────────────────────────────────────────────────────
 *  法的根拠・金額（最終確認日: 2026-08-17・一次資料の HTML を実測パース）
 * ─────────────────────────────────────────────────────────────
 *  厚生労働省「確定拠出年金制度の概要」
 *    https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/nenkin/nenkin/kyoshutsu/gaiyou.html
 *
 *  【iDeCo の拠出限度額】
 *  1. 国民年金第1号被保険者（自営業者等）: 68,000円/月
 *     ※国民年金基金の掛金、または国民年金の付加保険料を納付している場合はその額を控除
 *  2. 国民年金第2号被保険者（厚生年金保険の被保険者）
 *     - 企業年金等（確定給付型の年金・企業型DC）に加入していない場合（公務員を除く）: 23,000円/月
 *     - 企業年金等に加入している場合: 20,000円/月
 *       ただし「企業型DCの事業主掛金額 ＋ 他制度ごとの掛金相当額の合計が 55,000円の範囲内」
 *       ＝ 20,000円と「55,000円の残り枠」の**小さい方**が実際の上限になる
 *  3. 国民年金第3号被保険者（専業主婦（主夫）等）: 23,000円/月
 *  4. 国民年金任意加入被保険者: 68,000円/月（1と同じ控除あり）
 *
 *  【他制度掛金相当額（告示で定められている額）】
 *  - 国家公務員共済組合: 8,000円 / 地方公務員共済組合: 8,000円
 *  - 私立学校教職員共済制度: 7,000円 / 石炭鉱業年金基金: 9,000円
 *  ※確定給付企業年金(DB)・厚生年金基金の他制度掛金相当額は各規約に記載され加入者に周知される
 *    （固定値ではないので呼び出し側が渡す）
 *
 *  ※ 参考: 厚労省「iDeCo拠出限度額の引き上げ」（https://www.mhlw.go.jp/content/12500000/001597573.pdf）
 *    に引き上げ後の金額が示されている（第2号は企業年金の有無を問わず iDeCo・企業年金等の合計で
 *    月額6.2万円、第1号・第4号は iDeCo・国民年金基金等の合計で月額7.5万円、
 *    60歳以上70歳未満の「第5号加入者」を新設）。
 *    **ただし同資料には施行日が記載されておらず、施行日を一次情報で確認できなかったため
 *    意図的に分岐を実装していない。** 推測した日付で `asOf` 分岐を入れると、その日を境に
 *    答えが黙って変わる（D4・D5 で施行日を asOf 必須にしたのは日程が確定していたから）。
 *    施行日が確認できた時点で SCHEDULE 化する。
 */

/** iDeCo の加入区分。 */
export type IdecoCategory =
  /** 第1号被保険者（自営業者等） */
  | 'first'
  /** 第2号被保険者（厚生年金保険の被保険者） */
  | 'second'
  /** 第3号被保険者（専業主婦（主夫）等） */
  | 'third'
  /** 任意加入被保険者 */
  | 'voluntary';

/** 区分ごとの iDeCo 拠出限度額（円/月）。 */
export const IDECO_MONTHLY_LIMIT = {
  /** 第1号被保険者 */
  first: 68_000,
  /** 第2号・企業年金等に加入していない場合（公務員を除く） */
  secondWithoutCorporatePlan: 23_000,
  /** 第2号・企業年金等に加入している場合 */
  secondWithCorporatePlan: 20_000,
  /** 第3号被保険者 */
  third: 23_000,
  /** 任意加入被保険者 */
  voluntary: 68_000,
} as const;

/**
 * 企業型DCの事業主掛金額と他制度掛金相当額の合計に対する枠（円/月）。
 * 第2号・企業年金ありの iDeCo 上限は、この残り枠にも縛られる。
 */
export const COMBINED_MONTHLY_CAP = 55_000;

/**
 * 告示で額が定められている他制度掛金相当額（円/月）。
 * DB・厚生年金基金は規約ごとに異なるため含まない（呼び出し側が実額を渡す）。
 */
export const OTHER_PLAN_EQUIVALENT = {
  /** 国家公務員共済組合 */
  nationalPublicServant: 8_000,
  /** 地方公務員共済組合 */
  localPublicServant: 8_000,
  /** 私立学校教職員共済制度 */
  privateSchool: 7_000,
  /** 石炭鉱業年金基金 */
  coalMining: 9_000,
} as const;

export interface IdecoLimitInput {
  category: IdecoCategory;
  /**
   * 企業年金等（確定給付型の年金・企業型DC）に加入しているか。第2号のときだけ意味を持つ。
   * 公務員は共済（他制度）に加入しているため true になる。
   */
  hasCorporatePlan?: boolean;
  /** 企業型DCの事業主掛金額（円/月）。第2号・企業年金ありのとき合計枠を消費する。 */
  corporateDcEmployerContribution?: number;
  /** 他制度掛金相当額の合計（円/月）。DB・厚生年金基金は規約の額、共済等は告示の額。 */
  otherPlanEquivalent?: number;
  /** 国民年金基金の掛金＋付加保険料（円/月）。第1号・任意加入のとき控除される。 */
  kokuminNenkinFundContribution?: number;
}

export interface IdecoLimitResult {
  /** 実際に拠出できる上限（円/月）。0 未満にはならない。 */
  limit: number;
  /** 区分ごとの基本の上限（控除・合計枠を適用する前の額） */
  baseLimit: number;
  /** 上限を決めた理由 */
  boundBy: 'category' | 'combinedCap' | 'fundDeduction';
  /** 第2号・企業年金ありのときの合計枠の残り（それ以外は null） */
  combinedRoomRemaining: number | null;
}

const nonNeg = (n: number | undefined): number =>
  typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : 0;

/**
 * iDeCo の拠出限度額（円/月）を求める。
 *
 * 第2号・企業年金ありのケースが D9 の本体。20,000円という区分上限と、
 * 「企業型DC事業主掛金＋他制度掛金相当額の合計が55,000円の範囲内」という合計枠の
 * **両方**が効き、小さい方が実際の上限になる。片方だけ見ると過大に見積もる。
 */
export function idecoMonthlyLimit(input: IdecoLimitInput): IdecoLimitResult {
  if (input.category === 'first' || input.category === 'voluntary') {
    const base = IDECO_MONTHLY_LIMIT[input.category];
    const deduction = nonNeg(input.kokuminNenkinFundContribution);
    const limit = Math.max(0, base - deduction);
    return {
      limit,
      baseLimit: base,
      boundBy: deduction > 0 ? 'fundDeduction' : 'category',
      combinedRoomRemaining: null,
    };
  }

  if (input.category === 'third') {
    return {
      limit: IDECO_MONTHLY_LIMIT.third,
      baseLimit: IDECO_MONTHLY_LIMIT.third,
      boundBy: 'category',
      combinedRoomRemaining: null,
    };
  }

  // 第2号
  if (!input.hasCorporatePlan) {
    const base = IDECO_MONTHLY_LIMIT.secondWithoutCorporatePlan;
    return { limit: base, baseLimit: base, boundBy: 'category', combinedRoomRemaining: null };
  }

  const base = IDECO_MONTHLY_LIMIT.secondWithCorporatePlan;
  const used =
    nonNeg(input.corporateDcEmployerContribution) + nonNeg(input.otherPlanEquivalent);
  const room = Math.max(0, COMBINED_MONTHLY_CAP - used);
  const limit = Math.min(base, room);
  return {
    limit,
    baseLimit: base,
    boundBy: room < base ? 'combinedCap' : 'category',
    combinedRoomRemaining: room,
  };
}

/** 年額に換算した拠出限度額（円/年）。 */
export function idecoAnnualLimit(input: IdecoLimitInput): number {
  return idecoMonthlyLimit(input).limit * 12;
}
