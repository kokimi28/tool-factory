/**
 * iDeCo受取税シミュレーター - 計算ロジック (S002)
 *
 * iDeCo/企業型DCの一時金と会社の退職金を、いずれも「一時金」で受け取る場合に、
 * 受取順序・間隔によって退職所得控除がどう調整され、税額・手取りがどう変わるかを試算する。
 *
 * 兄弟プロジェクト S001（退職金課税シミュレーター）の基礎関数を流用・移植し、
 * iDeCo 固有ロジック（重複期間の控除減額／みなし勤続年数の逆算／同年合算）を追加している。
 *
 * すべての計算式は法的根拠コメント付き。UI層からは calcIdecoSim() / compareVariants() を呼ぶ。
 * 純粋関数・副作用なし（laterReceiptYear 省略時の「現在年」取得を除く）。
 *
 * 最終確認日: 2026-06-21
 * 適用法令: 令和8年（2026年）1月1日施行
 *
 * 主要な参照:
 * - 所得税法第30条第2項・第3項（退職所得・退職所得控除）
 * - 所得税法施行令第69条（勤続年数の計算・端数切上・同一年の通算）
 * - 所得税法施行令第70条（退職所得控除額の計算の特例＝重複期間の調整・みなし勤続期間）
 * - 所得税法施行令第72条第7号（iDeCo/企業型DC の掛金拠出期間を勤続年数とみなす）
 * - 国税庁タックスアンサー No.1420（退職金を受け取ったとき）
 * - 国税庁タックスアンサー No.2732（退職所得控除額の計算の特例＝勤続期間の重複・みなし）
 * - 国税庁タックスアンサー No.2735（同じ年に2か所以上から退職手当等が支払われるとき）
 * - 国税庁 退職所得の源泉徴収税額の速算表（令和7年分・令和8年分とも変更なし）
 *
 * 2026年（令和8年）改正:
 * - iDeCo 一時金を先に受け取り、その後に退職金を受け取る場合の重複判定期間が
 *   「前年以前4年内（5年ルール）」→「前年以前9年内（10年ルール）」に延長。
 *   令和8年1月1日以後に支払われる退職金に適用。
 */

// ============================================================
// 定数定義（マジックナンバーは全てここに集約）
// ============================================================

/** 勤続20年以下の年あたり控除額（円）／所法30③ */
const RETIREMENT_DEDUCTION_PER_YEAR_UNDER_20 = 400_000;
/** 退職所得控除の最低保証額（円）／所法30③ */
const RETIREMENT_DEDUCTION_MIN = 800_000;
/** 勤続20年超の基礎控除額（円、20年分）／所法30③ */
const RETIREMENT_DEDUCTION_OVER_20_BASE = 8_000_000;
/** 勤続20年超の年あたり追加控除額（円）／所法30③ */
const RETIREMENT_DEDUCTION_PER_YEAR_OVER_20 = 700_000;
/** 控除式の20年分岐／所法30③ */
const DEDUCTION_OVER_20_THRESHOLD_YEARS = 20;

/** 復興特別所得税率（所得税の2.1%加算）／復興財確法 */
const RECONSTRUCTION_TAX_RATE = 0.021;

/** 住民税率（一律10%、道府県民税4%＋市町村民税6%。政令市差は無視＝S001方針） */
const RESIDENT_TAX_RATE = 0.1;

/** 課税退職所得金額の1,000円未満切り捨て単位／所法30② */
const TAXABLE_INCOME_ROUND_UNIT = 1_000;
/** 住民税の100円未満切り捨て単位（合計表示モード） */
const RESIDENT_TAX_ROUND_UNIT = 100;
/** 退職所得の1/2課税の除数／所法30② */
const HALF_TAXATION_DIVISOR = 2;

/**
 * 退職金 先 → iDeCo 後（19年ルール）のルックバック年数。
 * iDeCo を受け取る年の「前年以前19年内」に退職金があれば重複調整。
 * 令和4年（2022年）に14年→19年へ延長済み。2026年改正での変更なし。
 * 所令70①二
 */
const LOOKBACK_TAISHOKU_FIRST = 19;
/**
 * iDeCo 先 → 退職金 後（10年ルール／2026年改正後）のルックバック年数。
 * 退職金を受け取る年の「前年以前9年内」に iDeCo があれば重複調整。
 * 令和8年1月1日以後に支払われる退職金に適用。
 */
const LOOKBACK_IDECO_FIRST_2026 = 9;
/**
 * iDeCo 先 → 退職金 後（旧5年ルール／改正前）のルックバック年数。
 * 退職金を受け取る年の「前年以前4年内」に iDeCo があれば重複調整。
 * 令和7年12月31日以前に支払われる退職金に適用。
 */
const LOOKBACK_IDECO_FIRST_LEGACY = 4;
/** 10年ルール（令和8年改正）の適用開始年。これ以後に支払われる退職金に適用。 */
const REFORM_2026_YEAR = 2026;

// ============================================================
// 速算表
// ============================================================

/**
 * 退職所得の源泉徴収税額の速算表（令和7年分・令和8年分）
 * 参照: 国税庁 退職所得の源泉徴収税額の速算表
 * 最終確認日: 2026-06-21
 */
const INCOME_TAX_BRACKETS: ReadonlyArray<{ upTo: number; rate: number; deduction: number }> = [
  { upTo: 1_950_000, rate: 0.05, deduction: 0 },
  { upTo: 3_300_000, rate: 0.1, deduction: 97_500 },
  { upTo: 6_950_000, rate: 0.2, deduction: 427_500 },
  { upTo: 9_000_000, rate: 0.23, deduction: 636_000 },
  { upTo: 18_000_000, rate: 0.33, deduction: 1_536_000 },
  { upTo: 40_000_000, rate: 0.4, deduction: 2_796_000 },
  { upTo: Infinity, rate: 0.45, deduction: 4_796_000 },
];

// ============================================================
// 型定義
// ============================================================

/** 受取順序 */
export type ReceiptOrder =
  | 'taishoku_first' // 退職金を先に受給 → iDeCo を後に受給
  | 'ideco_first' // iDeCo を先に受給 → 退職金を後に受給
  | 'same_year'; // 同一年に両方受給（同年合算）

/** 一時金1本分の入力 */
export type LumpSumInput = {
  /** 受取額（円） */
  amount: number;
  /** 勤続年数 or iDeCo加入年数（整数年） */
  years: number;
  /** 端数月（0-11）。1日以上で1年に切り上げ／所令69 */
  months?: number;
};

/** 計算入力 */
export type IdecoSimInput = {
  /** 退職金（円・勤続年数・端数月） */
  taishokukin: LumpSumInput;
  /** iDeCo/企業型DC 一時金（円・加入年数・端数月） */
  ideco: LumpSumInput;
  /** 受取順序 */
  order: ReceiptOrder;
  /** 受取間隔（年）。same_year は 0 */
  gapYears: number;
  /** 勤続期間と iDeCo加入期間の重複年数（直接入力の簡易モデル） */
  overlapYears: number;
  /** 後の一時金の受給年（改正適用判定。省略時は現在年） */
  laterReceiptYear?: number;
};

/** 一時金1本（または合算）の内訳 */
export type ReceiptBreakdown = {
  /** 表示ラベル */
  label: '退職金' | 'iDeCo一時金' | '合算';
  /** 収入金額（円） */
  income: number;
  /** 重複調整前の退職所得控除額（満額、円） */
  baseDeduction: number;
  /** 重複による控除減額（円） */
  overlapReduction: number;
  /** 実際に適用される退職所得控除額（円） */
  deduction: number;
  /** 課税退職所得金額（円、1,000円未満切り捨て後） */
  taxableIncome: number;
  /** 所得税額（円、復興特別所得税込み、1円未満切り捨て） */
  incomeTax: number;
  /** 住民税額（円） */
  residentTax: number;
  /** 手取り額（円） */
  netAmount: number;
};

/** 適用された控除調整ルール */
export type AppliedRule = '19年ルール' | '10年ルール' | '同年合算' | '調整なし';

/** 計算結果 */
export type IdecoSimResult = {
  /** 同年なら[合算]1件、別年なら[先, 後]の2件 */
  receipts: ReceiptBreakdown[];
  /** 収入合計（円） */
  totalIncome: number;
  /** 税額合計（所得税＋住民税、円） */
  totalTax: number;
  /** 手取り合計（円） */
  totalNet: number;
  /** 適用された控除調整ルール */
  appliedRule: AppliedRule;
  /** 控除調整（重複排除 or 通算）が行われたか */
  adjustmentApplied: boolean;
  /** 警告・前提（簡易化の明示、専門家相談誘導 等） */
  notes: string[];
};

// ============================================================
// ユーティリティ（S001 流用）
// ============================================================

/**
 * 勤続年数（iDeCo は加入年数）の切り上げ
 * 法的根拠: 所得税法施行令第69条第1項第1号、タックスアンサー No.1420
 * 「1年未満の端数があるときは、その端数を1年に切り上げる」
 * 最終確認日: 2026-06-21
 *
 * iDeCo/企業型DC は掛金拠出期間を勤続年数とみなす（所令72七）。
 *
 * @param years 整数年
 * @param months 端数月（0-11、デフォルト0）
 * @returns 切り上げ後の年数
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
 * 退職所得控除額の基本式（最低保証なしの素の計算）
 * 法的根拠: 所得税法第30条第3項
 *
 * - 20年以下: 40万円 × 年数
 * - 20年超　: 800万円 + 70万円 × (年数 − 20)
 *
 * 注: ここでは最低80万円保証を「掛けない」。
 *     最低80万円は単独受給時の最終的な控除額に対する保証であり（所法30③ただし書）、
 *     重複期間の控除減額（所令70）の減算項に保証額を適用すると過大に減額され
 *     納税者不利かつ誤りになるため、減算項・通算項はこの素の式を使う。
 *     単独受給の控除額は calcRetirementDeduction() 側で最低保証を適用する。
 * 最終確認日: 2026-06-21
 *
 * @param years 年数（端数切り上げ後の整数）
 * @returns 控除額（円、最低保証なし）
 */
export function calcDeductionByFormula(years: number): number {
  if (years <= 0) return 0;
  if (years <= DEDUCTION_OVER_20_THRESHOLD_YEARS) {
    return RETIREMENT_DEDUCTION_PER_YEAR_UNDER_20 * years;
  }
  return (
    RETIREMENT_DEDUCTION_OVER_20_BASE +
    RETIREMENT_DEDUCTION_PER_YEAR_OVER_20 * (years - DEDUCTION_OVER_20_THRESHOLD_YEARS)
  );
}

/**
 * 単独受給時の退職所得控除額（最低80万円保証あり）
 * 法的根拠: 所得税法第30条第3項
 * 参照: 国税庁タックスアンサー No.1420
 * 最終確認日: 2026-06-21
 *
 * - 20年以下: max(40万円 × 年数, 80万円)
 * - 20年超　: 800万円 + 70万円 × (年数 − 20)
 *
 * @param years 年数（端数切り上げ後の整数）
 * @returns 控除額（円）
 */
export function calcRetirementDeduction(years: number): number {
  if (years <= 0) return 0;
  if (years <= DEDUCTION_OVER_20_THRESHOLD_YEARS) {
    return Math.max(calcDeductionByFormula(years), RETIREMENT_DEDUCTION_MIN);
  }
  return calcDeductionByFormula(years);
}

// ============================================================
// 重複期間の控除減額（所令70）
// ============================================================

/**
 * みなし勤続年数の逆算
 * 法的根拠: 所得税法施行令第70条、タックスアンサー No.2732
 * 最終確認日: 2026-06-21
 *
 * 前に受け取った一時金が退職所得控除を使い残している場合、前の勤続（加入）期間を
 * 「初日から下記みなし年数分」に短縮して重複を計算し直す。
 *
 * - 前収入 ≤ 800万円: floor(前収入 / 40万円)
 * - 前収入 > 800万円: floor((前収入 − 800万円) / 70万円) + 20
 *
 * @param priorIncome 前に受け取った一時金の収入金額（円）
 * @returns みなし勤続年数（整数）
 */
export function calcDeemedYearsFromAmount(priorIncome: number): number {
  if (priorIncome <= 0) return 0;
  if (priorIncome <= RETIREMENT_DEDUCTION_OVER_20_BASE) {
    return Math.floor(priorIncome / RETIREMENT_DEDUCTION_PER_YEAR_UNDER_20);
  }
  return (
    Math.floor(
      (priorIncome - RETIREMENT_DEDUCTION_OVER_20_BASE) / RETIREMENT_DEDUCTION_PER_YEAR_OVER_20,
    ) + DEDUCTION_OVER_20_THRESHOLD_YEARS
  );
}

/**
 * 重複排除に使う「重複年数」の確定
 * 法的根拠: 所得税法施行令第70条第3項（重複期間の1年未満は切り捨て＝納税者有利）、
 *           同条・タックスアンサー No.2732（みなし勤続期間による上限）
 * 最終確認日: 2026-06-21
 *
 * - 重複年数は1年未満切り捨て（所令70③）。
 * - 物理的に重複は前後どちらの期間も超えられないため min(前年数, 後年数) でクランプ。
 * - 前の一時金が控除を使い切っていれば、その切り捨て後重複年数をそのまま使用。
 * - 使い残している場合は、みなし勤続年数を上限とする（min）。
 *
 * ※本MVPは「重複年数を直接入力」する簡易モデル。厳密には暦日の重なりに依存するが、
 *   使い残し時はみなし年数で上限を掛ける近似とする（複雑ケースは税理士相談へ誘導）。
 *
 * @param priorIncome 前の一時金の収入金額（円）
 * @param priorYears 前の年数（端数切り上げ後）
 * @param laterYears 後の年数（端数切り上げ後）
 * @param overlapYears 入力された重複年数
 * @returns 重複排除に使用する重複年数（整数）
 */
export function calcUsedOverlapYears(
  priorIncome: number,
  priorYears: number,
  laterYears: number,
  overlapYears: number,
): number {
  const flooredOverlap = Math.min(
    Math.floor(Math.max(0, overlapYears)),
    Math.max(0, priorYears),
    Math.max(0, laterYears),
  );
  if (flooredOverlap <= 0) return 0;

  const priorDeduction = calcRetirementDeduction(priorYears);
  if (priorIncome >= priorDeduction) {
    // 前の一時金が控除を使い切っている → 重複年数をそのまま使用
    return flooredOverlap;
  }
  // 使い残している → みなし勤続年数を上限とする
  const deemedYears = calcDeemedYearsFromAmount(priorIncome);
  return Math.max(0, Math.min(flooredOverlap, deemedYears));
}

/**
 * 重複排除後の退職所得控除額（後に受給する一時金にのみ適用）
 * 法的根拠: 所得税法施行令第70条
 * 最終確認日: 2026-06-21
 *
 * 調整後控除 = base(後の年数) − base(重複年数)
 *   base() は最低保証なしの素の式（calcDeductionByFormula）。
 *
 * ⚠️ base(後の年数 − 重複年数) ではない。base(後の年数) − base(重複年数) が正しい。
 *    重複が20年を跨ぐと両者は一致しない（厳密版）。
 *    例: 重複21年 → base(21) = 800万 + 70万×1 = 870万 を減算する。
 *
 * @param laterYears 後の年数（端数切り上げ後）
 * @param usedOverlapYears calcUsedOverlapYears() で確定した重複年数
 * @returns { deduction: 調整後控除額(円), reduction: 減額分(円) }
 */
export function calcOverlapDeduction(
  laterYears: number,
  usedOverlapYears: number,
): { deduction: number; reduction: number } {
  const full = calcDeductionByFormula(laterYears);
  const reduction = calcDeductionByFormula(usedOverlapYears);
  const deduction = Math.max(0, full - reduction);
  return { deduction, reduction };
}

// ============================================================
// 課税退職所得金額 / 所得税 / 住民税（S001 流用）
// ============================================================

/**
 * 課税退職所得金額の計算（標準の1/2課税のみ）
 * 法的根拠: 所得税法第30条第2項
 * 最終確認日: 2026-06-21
 *
 * 課税退職所得金額 = max(0, 収入金額 − 退職所得控除額) × 1/2（1,000円未満切り捨て）
 *
 * ※短期退職手当等・特定役員退職手当等の特例は Phase 2（本MVPは標準のみ）。
 *
 * @param income 収入金額（円）
 * @param deduction 退職所得控除額（円）
 * @returns 課税退職所得金額（円、1,000円未満切り捨て）
 */
export function calcTaxableIncome(income: number, deduction: number): number {
  const afterDeduction = Math.max(0, income - deduction);
  if (afterDeduction <= 0) return 0;
  const raw = afterDeduction / HALF_TAXATION_DIVISOR;
  return Math.floor(raw / TAXABLE_INCOME_ROUND_UNIT) * TAXABLE_INCOME_ROUND_UNIT;
}

/**
 * 退職所得の所得税額（復興特別所得税2.1%込み）
 * 法的根拠: 所得税法 別表第二（速算表）、復興特別所得税法
 * 参照: 国税庁 退職所得の源泉徴収税額の速算表
 * 最終確認日: 2026-06-21
 *
 * 所得税 = floor(課税退職所得 × 税率 − 速算控除額)
 * 復興税 = floor(所得税 × 2.1%)
 * 合計 = 所得税 + 復興税（各段階で1円未満切り捨て＝S001 と同一実装）
 *
 * @param taxableIncome 課税退職所得金額（円、1,000円未満切り捨て済み）
 * @returns 所得税額（円、復興特別所得税込み）
 */
export function calcIncomeTax(taxableIncome: number): number {
  if (taxableIncome <= 0) return 0;
  const bracket = INCOME_TAX_BRACKETS.find((b) => taxableIncome <= b.upTo);
  if (!bracket) return 0;
  const baseTax = Math.floor(taxableIncome * bracket.rate - bracket.deduction);
  if (baseTax <= 0) return 0;
  const reconstructionTax = Math.floor(baseTax * RECONSTRUCTION_TAX_RATE);
  return baseTax + reconstructionTax;
}

/**
 * 退職所得の住民税額（一律10%）
 * 法的根拠: 地方税法（現年分離課税）
 * 最終確認日: 2026-06-21
 *
 * 住民税 = 課税退職所得金額 × 10%（100円未満切り捨て）
 * ※課税退職所得金額は1,000円単位のため、×10%は必ず100円単位となり切り捨ては実質無影響。
 *   道府県民税4%・市町村民税6%の個別切り捨て・政令市差は無視（S001方針）。
 *
 * @param taxableIncome 課税退職所得金額（円、1,000円未満切り捨て済み）
 * @returns 住民税額（円、100円未満切り捨て）
 */
export function calcResidentTax(taxableIncome: number): number {
  if (taxableIncome <= 0) return 0;
  const raw = taxableIncome * RESIDENT_TAX_RATE;
  return Math.floor(raw / RESIDENT_TAX_ROUND_UNIT) * RESIDENT_TAX_ROUND_UNIT;
}

// ============================================================
// 内部ヘルパー
// ============================================================

/**
 * 一時金1本分の税額内訳を計算する（控除額を与えて課税以降を組み立てる）
 */
function buildBreakdown(
  label: ReceiptBreakdown['label'],
  income: number,
  baseDeduction: number,
  deduction: number,
): ReceiptBreakdown {
  const taxableIncome = calcTaxableIncome(income, deduction);
  const incomeTax = calcIncomeTax(taxableIncome);
  const residentTax = calcResidentTax(taxableIncome);
  return {
    label,
    income,
    baseDeduction,
    overlapReduction: Math.max(0, baseDeduction - deduction),
    deduction,
    taxableIncome,
    incomeTax,
    residentTax,
    netAmount: income - incomeTax - residentTax,
  };
}

/** 後に受給する一時金に適用する重複判定のルックバック年数を返す */
function resolveLookbackYears(order: ReceiptOrder, laterReceiptYear: number): number {
  if (order === 'taishoku_first') {
    // 退職金 先 → iDeCo 後（19年ルール）
    return LOOKBACK_TAISHOKU_FIRST;
  }
  // iDeCo 先 → 退職金 後（10年ルール／改正後 or 旧5年ルール）
  return laterReceiptYear >= REFORM_2026_YEAR
    ? LOOKBACK_IDECO_FIRST_2026
    : LOOKBACK_IDECO_FIRST_LEGACY;
}

/** 標準の免責・前提ノート */
const DISCLAIMER_NOTE =
  '本計算は令和8年1月1日施行の法令に基づく概算です。実際の税額は「退職所得の受給に関する申告書」の提出状況や個別事情により変わります。複雑なケースは税理士にご相談ください。';
const SIMPLE_MODEL_NOTE =
  '重複期間は暦日ではなく「重複年数」の直接入力に基づく簡易計算です。厳密な重複日数は源泉徴収票等でご確認ください。';

// ============================================================
// 統合計算
// ============================================================

/**
 * iDeCo一時金と退職金の受取シミュレーション（メインAPI）
 * UI層からはこの関数を呼ぶ。
 *
 * 法的根拠: 所法30②③ / 所令69③・70 / No.1420・No.2732・No.2735
 * 最終確認日: 2026-06-21
 *
 * @param input 入力値
 * @returns 計算結果（受取内訳・合計・適用ルール・注記）
 */
export function calcIdecoSim(input: IdecoSimInput): IdecoSimResult {
  const notes: string[] = [DISCLAIMER_NOTE];

  const taishokuYears = calcEffectiveYears(input.taishokukin.years, input.taishokukin.months ?? 0);
  const idecoYears = calcEffectiveYears(input.ideco.years, input.ideco.months ?? 0);

  // ---------------------------------------------------------
  // 同年合算（所令69③ / No.2735）
  // ---------------------------------------------------------
  if (input.order === 'same_year') {
    // 通算年数 = 退職金年数 + iDeCo年数 − 重複年数（重複は二重計上しない）
    // 重複は1年未満切り捨て・両期間を超えないようクランプ。
    const flooredOverlap = Math.min(
      Math.floor(Math.max(0, input.overlapYears)),
      taishokuYears,
      idecoYears,
    );
    const combinedYears = taishokuYears + idecoYears - flooredOverlap;
    const income = input.taishokukin.amount + input.ideco.amount;
    // 重複無視の単純合算控除（表示用の満額）と、通算控除（実際の控除）。
    const naiveDeduction = calcRetirementDeduction(taishokuYears + idecoYears);
    const deduction = calcRetirementDeduction(combinedYears);

    const breakdown = buildBreakdown('合算', income, naiveDeduction, deduction);

    notes.push(SIMPLE_MODEL_NOTE);
    notes.push(
      '同一年に複数の退職手当等を受け取るため、勤続期間を通算して退職所得控除を計算しています（所令69③）。',
    );
    if (taishokuYears <= 5 || idecoYears <= 5) {
      notes.push(
        '勤続5年以下が含まれる場合、短期退職手当等・特定役員退職手当等の特例（No.2741等）が関わる可能性があります。該当時は税理士にご相談ください（本ツールは標準計算のみ）。',
      );
    }

    return {
      receipts: [breakdown],
      totalIncome: income,
      totalTax: breakdown.incomeTax + breakdown.residentTax,
      totalNet: breakdown.netAmount,
      appliedRule: '同年合算',
      adjustmentApplied: flooredOverlap > 0,
      notes,
    };
  }

  // ---------------------------------------------------------
  // 別年受給（taishoku_first / ideco_first）
  // ---------------------------------------------------------
  const taishokuFirst = input.order === 'taishoku_first';

  // 前（earlier）と後（later）の割り当て
  const earlier = taishokuFirst
    ? { label: '退職金' as const, amount: input.taishokukin.amount, years: taishokuYears }
    : { label: 'iDeCo一時金' as const, amount: input.ideco.amount, years: idecoYears };
  const later = taishokuFirst
    ? { label: 'iDeCo一時金' as const, amount: input.ideco.amount, years: idecoYears }
    : { label: '退職金' as const, amount: input.taishokukin.amount, years: taishokuYears };

  // 前の一時金は単独計算（調整なし）
  const earlierDeduction = calcRetirementDeduction(earlier.years);
  const earlierBreakdown = buildBreakdown(
    earlier.label,
    earlier.amount,
    earlierDeduction,
    earlierDeduction,
  );

  // 後の一時金の重複調整判定
  const laterReceiptYear = input.laterReceiptYear ?? new Date().getFullYear();
  const lookbackYears = resolveLookbackYears(input.order, laterReceiptYear);
  const adjust = input.gapYears <= lookbackYears; // 間隔がルックバック超なら調整なし

  const laterBaseDeduction = calcRetirementDeduction(later.years);
  let laterDeduction = laterBaseDeduction;
  let appliedRule: AppliedRule = '調整なし';
  let adjustmentApplied = false;

  if (adjust) {
    const usedOverlap = calcUsedOverlapYears(
      earlier.amount,
      earlier.years,
      later.years,
      input.overlapYears,
    );
    const { deduction } = calcOverlapDeduction(later.years, usedOverlap);
    laterDeduction = deduction;
    adjustmentApplied = true;
    appliedRule = taishokuFirst ? '19年ルール' : '10年ルール';

    notes.push(SIMPLE_MODEL_NOTE);

    // 使い残し（みなし勤続年数）による調整が関与したか
    const priorFullyUsed = earlier.amount >= calcRetirementDeduction(earlier.years);
    if (!priorFullyUsed) {
      notes.push(
        'みなし勤続年数による調整を適用しています（前の一時金が退職所得控除を使い残しているケース）。実際は重複期間の暦日に依存するため、詳細は税理士にご確認ください。',
      );
    }
    // 改正前（旧5年ルール）の判定が使われた場合の注記
    if (!taishokuFirst && laterReceiptYear < REFORM_2026_YEAR) {
      notes.push(
        '後に受け取る退職金の支払が令和8年1月1日より前のため、改正前の旧制度（前年以前4年内＝5年ルール）で判定しています。',
      );
    }
  } else {
    notes.push(
      `受取間隔（${input.gapYears}年）がルックバック期間（${lookbackYears}年）を超えるため、退職所得控除の重複調整は不要です（控除は満額×2）。`,
    );
  }

  const laterBreakdown = buildBreakdown(
    later.label,
    later.amount,
    laterBaseDeduction,
    laterDeduction,
  );

  // receipts は [先, 後] の順
  const receipts = [earlierBreakdown, laterBreakdown];
  const totalIncome = earlier.amount + later.amount;
  const totalTax =
    earlierBreakdown.incomeTax +
    earlierBreakdown.residentTax +
    laterBreakdown.incomeTax +
    laterBreakdown.residentTax;
  const totalNet = earlierBreakdown.netAmount + laterBreakdown.netAmount;

  return {
    receipts,
    totalIncome,
    totalTax,
    totalNet,
    appliedRule,
    adjustmentApplied,
    notes,
  };
}

// ============================================================
// 差別化要素: 隣接2比較
// ============================================================

/** 受取順序を反転（同年は反転不可のためそのまま） */
function flipOrder(order: ReceiptOrder): ReceiptOrder {
  if (order === 'taishoku_first') return 'ideco_first';
  if (order === 'ideco_first') return 'taishoku_first';
  return 'same_year';
}

/**
 * 隣接2比較（差別化要素）
 * - reversedOrder: 受取順序を反転した場合
 * - enoughGap   : 重複調整を回避できる間隔まで空けた場合（満額×2）
 *
 * 受取順序・間隔の自由入力に対し、「順序を入れ替えたら」「十分に間隔を空けたら」
 * どれだけ手取りが変わるかを即座に提示するための比較。
 *
 * @param input 基準となる入力値
 * @returns { base, reversedOrder, enoughGap }
 */
export function compareVariants(input: IdecoSimInput): {
  base: IdecoSimResult;
  reversedOrder: IdecoSimResult;
  enoughGap: IdecoSimResult;
} {
  const base = calcIdecoSim(input);

  // 順序反転
  const reversedOrder = calcIdecoSim({ ...input, order: flipOrder(input.order) });

  // 重複調整を回避できる間隔まで空けたケース。
  // 同年の場合は「別年に分けて十分空ける」前提で退職金先に振り替える。
  const gapOrder: ReceiptOrder = input.order === 'same_year' ? 'taishoku_first' : input.order;
  const laterReceiptYear = input.laterReceiptYear ?? new Date().getFullYear();
  const enoughGapYears = resolveLookbackYears(gapOrder, laterReceiptYear) + 1;
  const enoughGap = calcIdecoSim({ ...input, order: gapOrder, gapYears: enoughGapYears });

  return { base, reversedOrder, enoughGap };
}
