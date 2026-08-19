"use client";

import { useMemo, useState } from "react";
import {
  idecoMonthlyLimit,
  idecoAnnualLimit,
  IDECO_MONTHLY_LIMIT,
  COMBINED_MONTHLY_CAP,
  OTHER_PLAN_EQUIVALENT,
  type IdecoCategory,
  type IdecoLimitInput,
} from "@/lib/ideco/limits";

const yen = (n: number) => `${Math.round(n).toLocaleString("ja-JP")}円`;

const CATEGORY_LABEL: Record<IdecoCategory, string> = {
  first: "第1号被保険者（自営業・フリーランス等）",
  second: "第2号被保険者（会社員・公務員）",
  third: "第3号被保険者（扶養に入っている配偶者）",
  voluntary: "任意加入被保険者",
};

/** 上限を決めた理由の説明（画面とテストで共有する）。 */
export const BOUND_BY_LABEL = {
  category: "加入区分ごとの上限",
  combinedCap: `企業型DC事業主掛金＋他制度掛金相当額の合計枠（月${COMBINED_MONTHLY_CAP.toLocaleString("ja-JP")}円）`,
  fundDeduction: "国民年金基金・付加保険料との合算",
} as const;

/**
 * iDeCo の拠出限度額（H5）。
 *
 * 区分上限だけを見ると過大に見積もる（第2号・企業年金ありは合計枠にも縛られる）。
 * lib/ideco/limits.ts が両方を効かせて小さい方を返すので、その理由まで画面に出す。
 */
export default function ContributionLimit() {
  const [category, setCategory] = useState<IdecoCategory>("second");
  const [hasCorporatePlan, setHasCorporatePlan] = useState(false);
  const [employerDc, setEmployerDc] = useState("0");
  const [otherPlan, setOtherPlan] = useState("0");
  const [fund, setFund] = useState("0");

  const toInt = (s: string) => Number(s.replace(/[^0-9]/g, "")) || 0;

  const input: IdecoLimitInput = useMemo(
    () => ({
      category,
      hasCorporatePlan,
      corporateDcEmployerContribution: toInt(employerDc),
      otherPlanEquivalent: toInt(otherPlan),
      kokuminNenkinFundContribution: toInt(fund),
    }),
    [category, hasCorporatePlan, employerDc, otherPlan, fund],
  );

  const result = useMemo(() => idecoMonthlyLimit(input), [input]);
  const annual = useMemo(() => idecoAnnualLimit(input), [input]);

  const showCorporate = category === "second";
  const showFund = category === "first" || category === "voluntary";

  return (
    <section
      className="rounded-2xl border border-slate-200 bg-white p-6"
      aria-labelledby="ideco-limit-heading"
    >
      <h3 id="ideco-limit-heading" className="text-lg font-bold text-slate-800">
        いくらまで拠出できるか（拠出限度額）
      </h3>
      <p className="mt-2 text-sm text-slate-600">
        加入区分で上限が決まりますが、会社員で企業年金がある場合は
        <strong>企業型DCの事業主掛金と他制度掛金相当額の合計枠</strong>にも縛られ、小さいほうが実際の上限になります。
      </p>

      <div className="mt-4 space-y-3">
        <label className="block text-sm">
          <span className="font-medium text-slate-700">加入区分</span>
          <select
            className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2"
            value={category}
            onChange={(e) => setCategory(e.target.value as IdecoCategory)}
          >
            {(Object.keys(CATEGORY_LABEL) as IdecoCategory[]).map((k) => (
              <option key={k} value={k}>
                {CATEGORY_LABEL[k]}
              </option>
            ))}
          </select>
        </label>

        {showCorporate && (
          <>
            <label className="flex items-start gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 rounded border-slate-300"
                checked={hasCorporatePlan}
                onChange={(e) => setHasCorporatePlan(e.target.checked)}
              />
              <span>企業年金等（企業型DC・確定給付型）に加入している（公務員は該当）</span>
            </label>
            {hasCorporatePlan && (
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-xs text-slate-600">
                  企業型DCの事業主掛金（円/月）
                  <input
                    inputMode="numeric"
                    aria-label="企業型DCの事業主掛金"
                    className="mt-1 block w-full rounded border border-slate-300 px-2 py-1 text-right tabular-nums"
                    value={employerDc}
                    onChange={(e) => setEmployerDc(e.target.value)}
                  />
                </label>
                <label className="block text-xs text-slate-600">
                  他制度掛金相当額（円/月）
                  <input
                    inputMode="numeric"
                    aria-label="他制度掛金相当額"
                    className="mt-1 block w-full rounded border border-slate-300 px-2 py-1 text-right tabular-nums"
                    value={otherPlan}
                    onChange={(e) => setOtherPlan(e.target.value)}
                  />
                  <span className="mt-1 block text-slate-400">
                    共済は告示の額（国家・地方公務員{OTHER_PLAN_EQUIVALENT.nationalPublicServant.toLocaleString("ja-JP")}円／私学共済
                    {OTHER_PLAN_EQUIVALENT.privateSchool.toLocaleString("ja-JP")}円）。DB・厚生年金基金は規約の額
                  </span>
                </label>
              </div>
            )}
          </>
        )}

        {showFund && (
          <label className="block text-xs text-slate-600">
            国民年金基金の掛金＋付加保険料（円/月）
            <input
              inputMode="numeric"
              aria-label="国民年金基金の掛金と付加保険料"
              className="mt-1 block w-40 rounded border border-slate-300 px-2 py-1 text-right tabular-nums"
              value={fund}
              onChange={(e) => setFund(e.target.value)}
            />
          </label>
        )}
      </div>

      <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4" role="status">
        <p className="text-sm text-emerald-800">拠出できる上限</p>
        <p className="mt-1 text-2xl font-bold text-emerald-900 tabular-nums">
          月 {yen(result.limit)}
        </p>
        <p className="mt-1 text-xs text-emerald-800">年 {yen(annual)}</p>
        <p className="mt-2 text-xs text-emerald-900">
          決め手: {BOUND_BY_LABEL[result.boundBy]}
          {result.boundBy !== "category" && (
            <> （区分だけなら月{yen(result.baseLimit)}）</>
          )}
        </p>
        {result.combinedRoomRemaining !== null && (
          <p className="mt-1 text-xs text-emerald-800">
            合計枠の残り {yen(result.combinedRoomRemaining)}
          </p>
        )}
      </div>

      <p className="mt-3 text-xs text-slate-500">
        第1号・任意加入の上限は月{IDECO_MONTHLY_LIMIT.first.toLocaleString("ja-JP")}円、第3号は月
        {IDECO_MONTHLY_LIMIT.third.toLocaleString("ja-JP")}円です。実際の拠出可能額は運営管理機関の手続きで確認してください。
      </p>
    </section>
  );
}
