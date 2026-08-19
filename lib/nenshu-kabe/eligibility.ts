/**
 * 「自分に効く壁はどちらか」の判定（auto-backlog D4）。
 *
 * 106万円の壁（社会保険の加入）は年収だけでは決まらない。勤務先と働き方の条件を
 * すべて満たしたときだけ適用され、1つでも欠けると 106万円を超えても加入せず、
 * 扶養の判定は 130万円で行われる。calculations.ts はどちらの壁が効くかを
 * `SiWall` として**入力で受け取る**ので、その入力を条件から決めるのが本ファイル。
 *
 * ─────────────────────────────────────────────────────────────
 *  法的根拠・日程（最終確認日: 2026-08-16・一次資料を実測）
 * ─────────────────────────────────────────────────────────────
 *  日本年金機構「パート・アルバイトの皆さまへ、配偶者の扶養の範囲内でお勤めの皆さまへ」
 *  （ページ更新日 2026-06-30）
 *    https://www.nenkin.go.jp/tokusetsu/tekiyokakudai_kojin.html
 *  - 現在:「厚生年金保険の被保険者数が51人以上の企業等」で働く方が対象
 *  - **令和9年10月から**、企業等の範囲が「厚生年金保険の被保険者数が36人以上」に拡大
 *  - **所定内賃金 月額8.8万円以上の要件は令和8年10月に撤廃予定**
 *      （理由も明記されている:「最低賃金以上で週20時間以上働く場合は、所定内賃金が
 *        月額8.8万円以上となるため」＝週20時間要件が実質的に賃金要件を包含する）
 *  - 2カ月以内の期間を定めて使用される方・臨時に使用される方等は加入対象から除かれる
 *
 *  厚生労働省 社会保険適用拡大特設サイト https://www.mhlw.go.jp/tekiyoukakudai/
 *  - 企業規模の数え方:「フルタイム及びフルタイムの4分の3以上の労働時間で働く従業員の数
 *    （厚生年金保険の被保険者数）」。法人の場合は**法人全体**で判断する
 *
 *  ※「学生でないこと」は上記2ページの本文からは実測できなかった（条件一覧が画像）。
 *    既存記事が以前から掲げている条件なのでモデルには残すが、他の条件と違い
 *    本ファイルでは一次資料の引用を付けられていない。改定時に要再確認。
 */

/**
 * 判定日を指定しなかったときに使う日付（最終確認日）。
 *
 * 静的生成のページはビルド時刻で固まるため、サーバ側の描画では現在日を使えない。
 * 画面は「この日付で描画 → マウント後に実際の今日へ差し替える」ため、
 * ハイドレーションの前後で同じ値になるこの定数が必要になる。
 */
export const ELIGIBILITY_CHECKED_AT = '2026-08-16';

/** 社会保険の壁（円）。106万 = 適用拡大で加入 / 130万 = 扶養を外れて加入。 */
export type SiWall = 1_060_000 | 1_300_000;

/**
 * 制度変更の施行日。日付で分岐するのは、記事と計算が「いつ時点の話か」を
 * 取り違えないようにするため（2026-10 と 2027-10 の 2 段階が確定済み）。
 */
export const WALL_SCHEDULE = {
  /** 所定内賃金 月額8.8万円以上の要件が撤廃される日（令和8年10月） */
  wageRequirementRemovedOn: '2026-10-01',
  /** 企業規模要件が 51人以上 → 36人以上 に拡大される日（令和9年10月） */
  firmSizeLoweredOn: '2027-10-01',
  /** 現行の企業規模しきい値（厚生年金被保険者数） */
  firmSizeThresholdNow: 51,
  /** 令和9年10月以降の企業規模しきい値 */
  firmSizeThresholdAfter: 36,
  /** 週の所定労働時間の下限 */
  weeklyHoursThreshold: 20,
  /** 所定内賃金の月額下限（円・撤廃until） */
  monthlyWageThreshold: 88_000,
} as const;

export interface WallConditions {
  /**
   * 勤務先の厚生年金保険の被保険者数。
   * フルタイム＋フルタイムの4分の3以上で働く従業員の数。法人は法人全体で数える。
   */
  employeeCount: number;
  /** 週の所定労働時間（時間）。残業時間は含めない。 */
  weeklyHours: number;
  /** 所定内賃金の月額（円）。残業代・賞与・通勤手当は含めない。 */
  monthlyWage: number;
  /** 2か月を超える雇用の見込みがあるか（2か月以内の期間を定めた雇用は対象外）。 */
  employmentOverTwoMonths: boolean;
  /** 学生か（昼間部の学生は対象外）。 */
  isStudent: boolean;
}

/** 判定の内訳。どの条件で外れたかを UI・記事で説明できるようにする。 */
export interface WallEligibility {
  /** この人に実際に効く壁 */
  wall: SiWall;
  /** 106万円の壁（適用拡大）の対象か */
  coveredBy106: boolean;
  /** 満たしていない条件の説明（すべて満たしていれば空） */
  unmetConditions: string[];
  /** 判定に使った企業規模しきい値（asOf により 51 or 36） */
  firmSizeThreshold: number;
  /** 判定時点で賃金要件が有効か（令和8年10月に撤廃） */
  wageRequirementApplies: boolean;
}

/**
 * 判定時点で適用される企業規模しきい値を返す。
 * @param asOf 判定する日（YYYY-MM-DD）。既定は施行済みの現行値。
 */
export function firmSizeThreshold(asOf: string): number {
  return asOf >= WALL_SCHEDULE.firmSizeLoweredOn
    ? WALL_SCHEDULE.firmSizeThresholdAfter
    : WALL_SCHEDULE.firmSizeThresholdNow;
}

/** 判定時点で賃金要件（月額8.8万円以上）が生きているか。 */
export function wageRequirementApplies(asOf: string): boolean {
  return asOf < WALL_SCHEDULE.wageRequirementRemovedOn;
}

/**
 * 条件から「効く壁」を判定する。
 *
 * 条件を1つでも満たさなければ 106万円の壁は適用されず、130万円（扶養）で判定される。
 * これは「106万円を超えたら必ず手取りが下がる」という誤解を避けるための中核ロジック。
 *
 * @param asOf 判定する日（YYYY-MM-DD）。制度変更が2段階で入るため必須。
 */
export function judgeWall(c: WallConditions, asOf: string): WallEligibility {
  const threshold = firmSizeThreshold(asOf);
  const wageApplies = wageRequirementApplies(asOf);
  const unmet: string[] = [];

  if (!(c.employeeCount >= threshold)) {
    unmet.push(`勤務先の厚生年金被保険者数が${threshold}人未満`);
  }
  if (!(c.weeklyHours >= WALL_SCHEDULE.weeklyHoursThreshold)) {
    unmet.push(`週の所定労働時間が${WALL_SCHEDULE.weeklyHoursThreshold}時間未満`);
  }
  if (wageApplies && !(c.monthlyWage >= WALL_SCHEDULE.monthlyWageThreshold)) {
    unmet.push(
      `所定内賃金が月額${WALL_SCHEDULE.monthlyWageThreshold.toLocaleString('en-US')}円未満`,
    );
  }
  if (!c.employmentOverTwoMonths) {
    unmet.push('2か月を超える雇用の見込みがない');
  }
  if (c.isStudent) {
    unmet.push('学生である');
  }

  const coveredBy106 = unmet.length === 0;
  return {
    wall: coveredBy106 ? 1_060_000 : 1_300_000,
    coveredBy106,
    unmetConditions: unmet,
    firmSizeThreshold: threshold,
    wageRequirementApplies: wageApplies,
  };
}
