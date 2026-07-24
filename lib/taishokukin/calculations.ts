/**
 * 退職金課税シミュレーター - 計算ロジック
 *
 * すべての計算式は法的根拠コメント付き。
 * UI層からは calcAll() / compareWithOneMoreYear() を呼ぶ。
 *
 * 最終確認日: 2026-05-17
 * 適用法令: 令和7年（2025年）4月1日現在
 *
 * 主要な参照:
 * - 所得税法第30条（退職所得）
 * - 国税庁タックスアンサー No.1420（退職金を受け取ったとき）
 * - 国税庁タックスアンサー No.2737（役員等の勤続年数が5年以下である者に対する退職手当等）
 * - 国税庁タックスアンサー No.2740（短期退職手当等）
 * - 国税庁 退職所得の源泉徴収税額の速算表（令和7年分）
 */

// ============================================================
// 定数定義（マジックナンバーは全てここに集約）
// ============================================================

/** 勤続20年以下の年あたり控除額（円） */
const RETIREMENT_DEDUCTION_PER_YEAR_UNDER_20 = 400_000;
/** 退職所得控除の最低保証額（円） */
const RETIREMENT_DEDUCTION_MIN = 800_000;
/** 勤続20年超の基礎控除額（円、20年分） */
const RETIREMENT_DEDUCTION_OVER_20_BASE = 8_000_000;
/** 勤続20年超の年あたり追加控除額（円） */
const RETIREMENT_DEDUCTION_PER_YEAR_OVER_20 = 700_000;

/** 短期退職手当等の300万円分岐閾値（円） */
const SHORT_TERM_THRESHOLD = 3_000_000;
/** 短期退職手当等の300万円までの1/2課税分（円） */
const SHORT_TERM_HALF_PORTION = 1_500_000;

/** 復興特別所得税の係数（所得税の2.1%加算） */
const RECONSTRUCTION_TAX_MULTIPLIER = 1.021;

/** 住民税率（一律10%、政令市は内訳異なるが合計同じ） */
const RESIDENT_TAX_RATE = 0.10;

/** 「退職所得の受給に関する申告書」未提出時の源泉徴収率（20.42% = 所得税20% + 復興特別0.42%） */
const WITHHOLDING_RATE_NO_DECLARATION = 0.2042;

/** 役員等で勤続5年以下の特例 / 短期退職手当等の判定境界 */
const SHORT_SERVICE_YEARS = 5;

/** 1,000円未満切り捨て用 */
const TAXABLE_INCOME_ROUND_UNIT = 1_000;


/**
 * 退職所得の源泉徴収税額の速算表（令和7年分）
 * 参照: https://www.nta.go.jp/publication/pamph/gensen/zeigakuhyo2025/data/12-13.pdf
 */
const INCOME_TAX_BRACKETS: ReadonlyArray<{ upTo: number; rate: number; deduction: number }> = [
  { upTo: 1_950_000, rate: 0.05, deduction: 0 },
  { upTo: 3_300_000, rate: 0.10, deduction: 97_500 },
  { upTo: 6_950_000, rate: 0.20, deduction: 427_500 },
  { upTo: 9_000_000, rate: 0.23, deduction: 636_000 },
  { upTo: 18_000_000, rate: 0.33, deduction: 1_536_000 },
  { upTo: 40_000_000, rate: 0.40, deduction: 2_796_000 },
  { upTo: Infinity, rate: 0.45, deduction: 4_796_000 },
];

// ============================================================
// 型定義
// ============================================================

/** 計算分岐の種別 */
export type RetirementCategory =
  | 'general' // 一般退職手当等
  | 'specificExecutive' // 特定役員退職手当等（役員等で勤続5年以下）
  | 'shortTermUnder300' // 短期退職手当等（一般5年以下、控除後300万円以下）
  | 'shortTermOver300'; // 短期退職手当等（一般5年以下、控除後300万円超）

/** 退職理由（計算には影響しないがUI訴求に使う） */
export type SeparationReason = 'voluntary' | 'involuntary';

/** 計算入力 */
export type RetirementInput = {
  /** 退職金額（円） */
  retirementAmount: number;
  /** 勤続年数（整数年） */
  yearsOfService: number;
  /** 勤続月数（0-11、端数月）。1日以上で1年切り上げになるため、>0なら yearsOfService+1 として扱う */
  monthsOfService?: number;
  /** 役員等か */
  isExecutive: boolean;
  /** 退職理由（計算には影響しない、UI用） */
  separationReason?: SeparationReason;
};

/** 計算結果 */
export type RetirementResult = {
  /** 切り上げ後の勤続年数 */
  effectiveYears: number;
  /** 退職所得控除額（円） */
  retirementDeduction: number;
  /** 課税退職所得金額（円、1,000円未満切り捨て後） */
  taxableRetirementIncome: number;
  /** 所得税額（円、復興特別所得税含む、1円未満切り捨て） */
  incomeTax: number;
  /** 住民税額（円、100円未満切り捨て） */
  residentTax: number;
  /** 税額合計（円） */
  totalTax: number;
  /** 手取り額（円） */
  netAmount: number;
  /** 計算分岐の種別 */
  category: RetirementCategory;
};


// ============================================================
// ユーティリティ関数
// ============================================================

/**
 * 勤続年数の切り上げ
 * 法的根拠: 所得税法施行令第69条第1項第1号、タックスアンサー No.1420
 * 「1年未満の端数があるときは、その端数を1年に切り上げる」
 *
 * @param years 整数年
 * @param months 端数月（0-11、デフォルト0）
 * @returns 切り上げ後の勤続年数
 */
export function calcEffectiveYears(years: number, months: number = 0): number {
  if (years <= 0 && months <= 0) return 0;
  const safeYears = Math.max(0, Math.floor(years));
  const safeMonths = Math.max(0, Math.floor(months));
  return safeMonths > 0 ? safeYears + 1 : safeYears;
}

// ============================================================
// 退職所得控除額
// ============================================================

/**
 * 退職所得控除額の計算
 * 法的根拠: 所得税法第30条第3項
 * 参照: 国税庁タックスアンサー No.1420
 * URL: https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1420.htm
 * 最終確認日: 2026-05-17
 *
 * - 勤続20年以下: 40万円 × 勤続年数（最低80万円保証）
 * - 勤続20年超　: 800万円 + 70万円 × (勤続年数 - 20)
 *
 * @param years 勤続年数（端数切り上げ後の整数値）
 * @returns 控除額（円）
 */
export function calcRetirementDeduction(years: number): number {
  if (years <= 0) return 0;
  if (years <= 20) {
    return Math.max(RETIREMENT_DEDUCTION_PER_YEAR_UNDER_20 * years, RETIREMENT_DEDUCTION_MIN);
  }
  return (
    RETIREMENT_DEDUCTION_OVER_20_BASE +
    RETIREMENT_DEDUCTION_PER_YEAR_OVER_20 * (years - 20)
  );
}


// ============================================================
// 課税退職所得金額
// ============================================================

/**
 * 課税退職所得金額の計算（分岐ロジック含む）
 * 法的根拠:
 * - 所得税法第30条第2項（一般退職手当等の1/2課税）
 * - 所得税法第30条第4項（特定役員退職手当等、1/2課税なし）
 * - 所得税法第30条第5項、令和4年1月1日施行（短期退職手当等の300万円分岐）
 * 参照: タックスアンサー No.1420 / No.2737 / No.2740
 *
 * 分岐:
 * (1) 一般退職手当等（勤続6年以上 or 5年以下で役員以外かつ控除後300万円以下）:
 *     (収入 - 控除) × 1/2
 * (2) 特定役員退職手当等（役員等 かつ 勤続5年以下）:
 *     収入 - 控除（1/2なし）
 * (3) 短期退職手当等（一般従業員 かつ 勤続5年以下）:
 *     控除後 ≤ 300万円: (収入 - 控除) × 1/2
 *     控除後 > 300万円: 150万円 + {収入 - (300万円 + 控除)}
 *
 * 端数: 1,000円未満切り捨て
 *
 * @returns { amount: 課税退職所得金額（円、切り捨て後）, category: 分岐種別 }
 */
export function calcTaxableRetirementIncome(
  retirementAmount: number,
  deduction: number,
  isExecutive: boolean,
  effectiveYears: number,
): { amount: number; category: RetirementCategory } {
  const afterDeduction = retirementAmount - deduction;
  if (afterDeduction <= 0) {
    // 控除額以下は非課税
    return { amount: 0, category: effectiveYears <= SHORT_SERVICE_YEARS && isExecutive ? 'specificExecutive' : 'general' };
  }

  let raw: number;
  let category: RetirementCategory;

  if (effectiveYears <= SHORT_SERVICE_YEARS && isExecutive) {
    // (2) 特定役員退職手当等
    raw = afterDeduction;
    category = 'specificExecutive';
  } else if (effectiveYears <= SHORT_SERVICE_YEARS && !isExecutive) {
    // (3) 短期退職手当等
    if (afterDeduction <= SHORT_TERM_THRESHOLD) {
      raw = afterDeduction / 2;
      category = 'shortTermUnder300';
    } else {
      raw = SHORT_TERM_HALF_PORTION + (retirementAmount - (SHORT_TERM_THRESHOLD + deduction));
      category = 'shortTermOver300';
    }
  } else {
    // (1) 一般退職手当等
    raw = afterDeduction / 2;
    category = 'general';
  }

  // 1,000円未満切り捨て
  const amount = Math.floor(raw / TAXABLE_INCOME_ROUND_UNIT) * TAXABLE_INCOME_ROUND_UNIT;
  return { amount, category };
}


// ============================================================
// 所得税額（復興特別所得税込み）
// ============================================================

/**
 * 退職所得の所得税額の計算
 * 法的根拠:
 * - 所得税法 別表第二（所得税の速算表）
 * - 復興特別所得税法（東日本大震災からの復興のための施策を実施するために必要な財源の確保に関する特別措置法）
 * 参照: 国税庁 退職所得の源泉徴収税額の速算表（令和7年分）
 *
 * 計算式: (課税退職所得金額 × 税率 - 控除額) × 102.1%
 * 端数: 1円未満切り捨て
 *
 * 復興特別所得税は令和19年（2037年）12月31日まで適用。
 *
 * @param taxableIncome 課税退職所得金額（円、1,000円未満切り捨て済み）
 * @returns 所得税額（円、復興特別所得税込み、1円未満切り捨て）
 */
export function calcIncomeTax(taxableIncome: number): number {
  if (taxableIncome <= 0) return 0;
  const bracket = INCOME_TAX_BRACKETS.find((b) => taxableIncome <= b.upTo);
  if (!bracket) return 0; // 念のため
  const baseTax = Math.floor(taxableIncome * bracket.rate - bracket.deduction);
  if (baseTax <= 0) return 0;
  // 復興特別所得税は所得税の2.1%を別途切り捨てて加算（浮動小数点誤差回避）
  const reconstructionTax = Math.floor(baseTax * 0.021);
  return baseTax + reconstructionTax;
}

// ============================================================
// 住民税
// ============================================================

/**
 * 退職所得の住民税額の計算
 * 法的根拠: 地方税法第50条の2、第328条等
 * 参照: 各自治体の「退職所得に対する住民税の計算」案内
 *
 * 計算式: 課税退職所得金額 × 10%
 * 端数: 100円未満切り捨て（簡易表示モード）
 *
 * 注: 厳密には道府県民税4%・市町村民税6%を別々に100円未満切り捨てるため、
 *     合計が10%より僅かに少なくなることがあるが、MVPでは合計10%の簡易計算とする。
 *
 * @param taxableIncome 課税退職所得金額（円、1,000円未満切り捨て済み）
 * @returns 住民税額（円、100円未満切り捨て）
 */
export function calcResidentTax(taxableIncome: number): number {
  if (taxableIncome <= 0) return 0;
  const raw = taxableIncome * RESIDENT_TAX_RATE;
  // 100円未満切り捨て
  return Math.floor(raw / 100) * 100;
}


// ============================================================
// 申告書未提出時の源泉徴収（比較用）
// ============================================================

/**
 * 「退職所得の受給に関する申告書」未提出時の源泉徴収税額
 * 法的根拠: 所得税法第201条第3項
 * 参照: 国税庁タックスアンサー No.2732（退職手当等に対する源泉徴収）
 *
 * 申告書を提出しない場合、退職所得控除・2分の1課税・累進税率が一切適用されず、
 * 支払金額（退職金額）に一律 20.42%（所得税20% + 復興特別所得税0.42%）が課される。
 * 端数: 1円未満切り捨て。
 *
 * これは calcAll（申告書提出＝正規の税額）との比較で「出し忘れの損」を示すための関数。
 * 払いすぎた分は確定申告で精算できる。
 *
 * @param retirementAmount 退職金額（円）
 * @returns 源泉徴収税額（円、1円未満切り捨て）
 */
export function calcWithholdingWithoutDeclaration(retirementAmount: number): number {
  if (retirementAmount <= 0) return 0;
  return Math.floor(retirementAmount * WITHHOLDING_RATE_NO_DECLARATION);
}


// ============================================================
// 統合計算
// ============================================================

/**
 * 退職金課税の総合計算
 * UI層からはこの関数を呼ぶ。
 *
 * @param input 入力値
 * @returns 計算結果
 */
export function calcAll(input: RetirementInput): RetirementResult {
  const effectiveYears = calcEffectiveYears(input.yearsOfService, input.monthsOfService ?? 0);
  const retirementDeduction = calcRetirementDeduction(effectiveYears);
  const { amount: taxableRetirementIncome, category } = calcTaxableRetirementIncome(
    input.retirementAmount,
    retirementDeduction,
    input.isExecutive,
    effectiveYears,
  );
  const incomeTax = calcIncomeTax(taxableRetirementIncome);
  const residentTax = calcResidentTax(taxableRetirementIncome);
  const totalTax = incomeTax + residentTax;
  const netAmount = input.retirementAmount - totalTax;

  return {
    effectiveYears,
    retirementDeduction,
    taxableRetirementIncome,
    incomeTax,
    residentTax,
    totalTax,
    netAmount,
    category,
  };
}

// ============================================================
// 差別化要素A: 「あと1年勤めると」比較
// ============================================================

/** 比較結果 */
export type OneMoreYearComparison = {
  /** 現状の計算結果 */
  current: RetirementResult;
  /** あと1年勤めた場合の計算結果（退職金額は同額と仮定） */
  plusOneYear: RetirementResult;
  /** 控除額の差（円、増分） */
  deductionDiff: number;
  /** 手取り額の差（円、増分） */
  netAmountDiff: number;
  /** 税額合計の差（円、減分 = 節税効果） */
  totalTaxDiff: number;
};

/**
 * あと1年勤めた場合との比較
 * 差別化要素A: 退職検討者の「いつ辞めるべきか」判断を支援
 *
 * 退職金額は同額と仮定（実際は1年分のベースアップがあるが、それは別軸）。
 * 勤続20年→21年の境界では控除額が70万円増えるため、節税効果が大きい。
 *
 * @param input 現状の入力値
 * @returns 比較結果
 */
export function compareWithOneMoreYear(input: RetirementInput): OneMoreYearComparison {
  const current = calcAll(input);
  const plusInput: RetirementInput = {
    ...input,
    yearsOfService: input.yearsOfService + 1,
    monthsOfService: input.monthsOfService, // 端数月は据え置き
  };
  const plusOneYear = calcAll(plusInput);

  return {
    current,
    plusOneYear,
    deductionDiff: plusOneYear.retirementDeduction - current.retirementDeduction,
    netAmountDiff: plusOneYear.netAmount - current.netAmount,
    totalTaxDiff: current.totalTax - plusOneYear.totalTax, // プラス値が節税効果
  };
}

// ============================================================
// バリデーション
// ============================================================

/** 入力検証エラー */
export type ValidationError = {
  field: keyof RetirementInput;
  message: string;
};

/**
 * 入力値の検証
 * UI層で呼び出して、エラー表示に使う。
 */
export function validateInput(input: Partial<RetirementInput>): ValidationError[] {
  const errors: ValidationError[] = [];

  if (input.retirementAmount === undefined || input.retirementAmount === null || isNaN(input.retirementAmount)) {
    errors.push({ field: 'retirementAmount', message: '退職金額を入力してください' });
  } else if (input.retirementAmount < 0) {
    errors.push({ field: 'retirementAmount', message: '退職金額は0円以上を入力してください' });
  } else if (input.retirementAmount > 1_000_000_000) {
    errors.push({ field: 'retirementAmount', message: '退職金額が大きすぎます（10億円以下）' });
  }

  if (input.yearsOfService === undefined || input.yearsOfService === null || isNaN(input.yearsOfService)) {
    errors.push({ field: 'yearsOfService', message: '勤続年数を入力してください' });
  } else if (input.yearsOfService < 0) {
    errors.push({ field: 'yearsOfService', message: '勤続年数は0年以上を入力してください' });
  } else if (input.yearsOfService > 70) {
    errors.push({ field: 'yearsOfService', message: '勤続年数が長すぎます（70年以下）' });
  } else if (!Number.isInteger(input.yearsOfService)) {
    errors.push({ field: 'yearsOfService', message: '勤続年数は整数で入力してください（端数は月数で）' });
  }

  if (input.monthsOfService !== undefined && input.monthsOfService !== null) {
    if (isNaN(input.monthsOfService) || input.monthsOfService < 0 || input.monthsOfService > 11) {
      errors.push({ field: 'monthsOfService', message: '勤続月数は0〜11の範囲で入力してください' });
    }
  }

  return errors;
}
