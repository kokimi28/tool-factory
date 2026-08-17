/**
 * 加給年金額と振替加算（auto-backlog D6）。
 *
 * 加給年金は「老齢厚生年金に付く」加算なので、老齢厚生年金を繰り下げて受け取っていない
 * 待機期間中は支給されない（＝繰下げの「もらい損ね」の正体）。振替加算は、配偶者が65歳に
 * なって加給年金が打ち切られたあと、その配偶者自身の老齢基礎年金に付け替わる加算。
 *
 * ─────────────────────────────────────────────────────────────
 *  法的根拠・金額（最終確認日: 2026-08-17・一次資料の HTML を実測パース）
 * ─────────────────────────────────────────────────────────────
 *  日本年金機構「加給年金額と振替加算」（ページ更新日 2026-07-31）
 *    https://www.nenkin.go.jp/service/jukyu/seido/roureinenkin/kakyu-hurikae/20150401.html
 *
 *  【加給年金額（令和8年4月から）】
 *  - 配偶者: 243,800円（65歳未満であること。大正15年4月1日以前生まれの配偶者は年齢制限なし）
 *  - 1人目・2人目の子: 各243,800円
 *  - 3人目以降の子: 各81,300円
 *    （子の年齢制限: 18歳到達年度の末日まで、または1級・2級の障害の状態にある20歳未満）
 *  - 受給要件: 厚生年金保険の被保険者期間が20年以上（または40歳〔女性・坑内員・船員は35歳〕
 *    以降15〜19年）で、65歳到達時点（または定額部分支給開始年齢到達時点）に生計維持の
 *    配偶者または子がいること。**加算には届出が必要**
 *  - 配偶者の加給年金額には、**受給権者の生年月日**に応じて 36,000円〜179,900円 が特別加算される
 *
 *  【振替加算】
 *  - 対象: 大正15年4月2日〜昭和41年4月1日生まれ、ほか加入期間の要件あり
 *  - 額は配偶者の生年月日ごとに政令で定める率で決まり、昭和41年4月2日以後生まれはゼロ
 *
 *  ※ 本ファイルは**公示された年額をそのまま持つ**（率から計算し直さない）。
 *    理由: 令和8年度は老齢基礎年金の単価が生年月日で2段階（昭和31年4月1日以前生まれは
 *    243,100円・昭和31年4月2日以後生まれは 243,800円）になっており、単一の基準額に
 *    率を掛けると10行が1円〜140円ずれる。2段階であることはテストで検算している。
 *
 *  ※ 加給年金の支給停止（配偶者が20年以上の老齢厚生年金等の受給権を持つ場合）と
 *    令和4年4月以降の経過措置は世帯の受給権に依存するためモデル化しない。
 *    判定に必要な情報がツールの入力に無く、機械的に判定すると誤答するため。
 */

/** 生年月日で区切られた表の1行。bornFrom/bornTo は ISO 日付（null は無制限）。 */
export interface BirthDateBand {
  bornFrom: string | null;
  bornTo: string | null;
}

/** 加給年金の単価（円/年・令和8年4月から）。 */
export const KAKYU_AMOUNT = {
  /** 配偶者（65歳未満） */
  spouse: 243_800,
  /** 1人目・2人目の子（各） */
  childFirstSecond: 243_800,
  /** 3人目以降の子（各） */
  childThirdOnward: 81_300,
} as const;

export interface SpecialAdditionRow extends BirthDateBand {
  /** 特別加算額（円/年） */
  extra: number;
  /** 一次資料の生年月日表記 */
  label: string;
}

/**
 * 配偶者加給年金額の特別加算額（令和8年4月から）。**受給権者本人**の生年月日で決まる
 * （配偶者の生年月日ではない点に注意）。
 */
export const SPECIAL_ADDITION_TABLE: readonly SpecialAdditionRow[] = [
  { bornFrom: "1934-04-02", bornTo: "1940-04-01", extra: 36_000, label: "昭和9年4月2日から昭和15年4月1日" },
  { bornFrom: "1940-04-02", bornTo: "1941-04-01", extra: 71_900, label: "昭和15年4月2日から昭和16年4月1日" },
  { bornFrom: "1941-04-02", bornTo: "1942-04-01", extra: 108_000, label: "昭和16年4月2日から昭和17年4月1日" },
  { bornFrom: "1942-04-02", bornTo: "1943-04-01", extra: 143_900, label: "昭和17年4月2日から昭和18年4月1日" },
  { bornFrom: "1943-04-02", bornTo: null, extra: 179_900, label: "昭和18年4月2日以後" },
];

export interface FurikaeRow extends BirthDateBand {
  /** 政令で定める率 */
  rate: number;
  /** 年額（円）。一次資料の公示額をそのまま持つ。 */
  annual: number;
}

/** 振替加算の額（令和8年度）。**配偶者**の生年月日で決まる。 */
export const FURIKAE_TABLE: readonly FurikaeRow[] = [
  { bornFrom: null, bornTo: "1927-04-01", rate: 1.0, annual: 243_100 },
  { bornFrom: "1927-04-02", bornTo: "1928-04-01", rate: 0.973, annual: 236_536 },
  { bornFrom: "1928-04-02", bornTo: "1929-04-01", rate: 0.947, annual: 230_216 },
  { bornFrom: "1929-04-02", bornTo: "1930-04-01", rate: 0.92, annual: 223_652 },
  { bornFrom: "1930-04-02", bornTo: "1931-04-01", rate: 0.893, annual: 217_088 },
  { bornFrom: "1931-04-02", bornTo: "1932-04-01", rate: 0.867, annual: 210_768 },
  { bornFrom: "1932-04-02", bornTo: "1933-04-01", rate: 0.84, annual: 204_204 },
  { bornFrom: "1933-04-02", bornTo: "1934-04-01", rate: 0.813, annual: 197_640 },
  { bornFrom: "1934-04-02", bornTo: "1935-04-01", rate: 0.787, annual: 191_320 },
  { bornFrom: "1935-04-02", bornTo: "1936-04-01", rate: 0.76, annual: 184_756 },
  { bornFrom: "1936-04-02", bornTo: "1937-04-01", rate: 0.733, annual: 178_192 },
  { bornFrom: "1937-04-02", bornTo: "1938-04-01", rate: 0.707, annual: 171_872 },
  { bornFrom: "1938-04-02", bornTo: "1939-04-01", rate: 0.68, annual: 165_308 },
  { bornFrom: "1939-04-02", bornTo: "1940-04-01", rate: 0.653, annual: 158_744 },
  { bornFrom: "1940-04-02", bornTo: "1941-04-01", rate: 0.627, annual: 152_424 },
  { bornFrom: "1941-04-02", bornTo: "1942-04-01", rate: 0.6, annual: 145_860 },
  { bornFrom: "1942-04-02", bornTo: "1943-04-01", rate: 0.573, annual: 139_296 },
  { bornFrom: "1943-04-02", bornTo: "1944-04-01", rate: 0.547, annual: 132_976 },
  { bornFrom: "1944-04-02", bornTo: "1945-04-01", rate: 0.52, annual: 126_412 },
  { bornFrom: "1945-04-02", bornTo: "1946-04-01", rate: 0.493, annual: 119_848 },
  { bornFrom: "1946-04-02", bornTo: "1947-04-01", rate: 0.467, annual: 113_528 },
  { bornFrom: "1947-04-02", bornTo: "1948-04-01", rate: 0.44, annual: 106_964 },
  { bornFrom: "1948-04-02", bornTo: "1949-04-01", rate: 0.413, annual: 100_400 },
  { bornFrom: "1949-04-02", bornTo: "1950-04-01", rate: 0.387, annual: 94_080 },
  { bornFrom: "1950-04-02", bornTo: "1951-04-01", rate: 0.36, annual: 87_516 },
  { bornFrom: "1951-04-02", bornTo: "1952-04-01", rate: 0.333, annual: 80_952 },
  { bornFrom: "1952-04-02", bornTo: "1953-04-01", rate: 0.307, annual: 74_632 },
  { bornFrom: "1953-04-02", bornTo: "1954-04-01", rate: 0.28, annual: 68_068 },
  { bornFrom: "1954-04-02", bornTo: "1955-04-01", rate: 0.253, annual: 61_504 },
  { bornFrom: "1955-04-02", bornTo: "1956-04-01", rate: 0.227, annual: 55_184 },
  { bornFrom: "1956-04-02", bornTo: "1957-04-01", rate: 0.2, annual: 48_760 },
  { bornFrom: "1957-04-02", bornTo: "1958-04-01", rate: 0.173, annual: 42_177 },
  { bornFrom: "1958-04-02", bornTo: "1959-04-01", rate: 0.147, annual: 35_839 },
  { bornFrom: "1959-04-02", bornTo: "1960-04-01", rate: 0.12, annual: 29_256 },
  { bornFrom: "1960-04-02", bornTo: "1961-04-01", rate: 0.093, annual: 22_673 },
  { bornFrom: "1961-04-02", bornTo: "1962-04-01", rate: 0.067, annual: 16_335 },
  { bornFrom: "1962-04-02", bornTo: "1963-04-01", rate: 0.067, annual: 16_335 },
  { bornFrom: "1963-04-02", bornTo: "1964-04-01", rate: 0.067, annual: 16_335 },
  { bornFrom: "1964-04-02", bornTo: "1965-04-01", rate: 0.067, annual: 16_335 },
  { bornFrom: "1965-04-02", bornTo: "1966-04-01", rate: 0.067, annual: 16_335 },
];

/**
 * 令和8年度の老齢基礎年金 満額の単価（円/年）。生年月日で2段階になっている。
 * 振替加算の年額はこの単価に政令率を掛けたものなので、テストの検算に使う。
 */
export const BASIC_PENSION_UNIT = {
  /** 昭和31年4月1日以前生まれ */
  bornBefore1956_04_02: 243_100,
  /** 昭和31年4月2日以後生まれ */
  bornOnAfter1956_04_02: 243_800,
} as const;

/** 生年月日がその行の範囲に入るか。 */
const inBand = (birthDate: string, row: BirthDateBand): boolean =>
  (row.bornFrom === null || birthDate >= row.bornFrom) &&
  (row.bornTo === null || birthDate <= row.bornTo);

/**
 * 配偶者加給年金額の特別加算額（円/年）。受給権者の生年月日で決まる。
 * 表のどの帯にも入らない（昭和9年4月1日以前生まれ）場合は0。
 */
export function spouseSpecialAddition(recipientBirthDate: string): number {
  const row = SPECIAL_ADDITION_TABLE.find((r) => inBand(recipientBirthDate, r));
  return row ? row.extra : 0;
}

/**
 * 振替加算の年額（円）。配偶者の生年月日で決まる。
 * 昭和41年4月2日以後生まれは対象外なので0。
 */
export function furikaeKasan(spouseBirthDate: string): number {
  const row = FURIKAE_TABLE.find((r) => inBand(spouseBirthDate, r));
  return row ? row.annual : 0;
}

export interface KakyuInput {
  /** 生計維持している65歳未満の配偶者がいるか */
  hasEligibleSpouse: boolean;
  /** 年齢制限を満たす子の人数 */
  eligibleChildCount: number;
  /** 受給権者本人の生年月日（YYYY-MM-DD）。特別加算の判定に使う。 */
  recipientBirthDate: string;
}

export interface KakyuResult {
  /** 配偶者分（基本額＋特別加算） */
  spouseTotal: number;
  /** うち特別加算 */
  spouseSpecialAddition: number;
  /** 子の分の合計 */
  childrenTotal: number;
  /** 加給年金の合計（円/年） */
  total: number;
}

/**
 * 加給年金額を求める。
 *
 * 繰下げ待機中は老齢厚生年金が支給されていないため加給年金も出ない。その判断は
 * 呼び出し側が行う（本関数は「支給されるならいくらか」だけを返す）。
 */
export function kakyuPension(input: KakyuInput): KakyuResult {
  const count = Number.isFinite(input.eligibleChildCount)
    ? Math.max(0, Math.floor(input.eligibleChildCount))
    : 0;

  const extra = input.hasEligibleSpouse
    ? spouseSpecialAddition(input.recipientBirthDate)
    : 0;
  const spouseTotal = input.hasEligibleSpouse ? KAKYU_AMOUNT.spouse + extra : 0;

  const firstTwo = Math.min(count, 2);
  const rest = Math.max(0, count - 2);
  const childrenTotal =
    firstTwo * KAKYU_AMOUNT.childFirstSecond + rest * KAKYU_AMOUNT.childThirdOnward;

  return {
    spouseTotal,
    spouseSpecialAddition: extra,
    childrenTotal,
    total: spouseTotal + childrenTotal,
  };
}
