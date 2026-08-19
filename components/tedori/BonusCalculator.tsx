"use client";

import { useMemo, useState } from "react";
import { bonusOutcome, BONUS_UNSUPPORTED_MESSAGE } from "@/lib/tedori/bonus-ui";
import { validateNumberInput } from "@/lib/validate-input";

const yen = (n: number) => `${Math.round(n).toLocaleString("ja-JP")}円`;

/** 入力欄1つぶんの規則（E9 と同じ validateNumberInput を使う）。 */
const FIELD_RULES = { max: 100_000_000 } as const;

/**
 * 賞与（ボーナス）の手取り（H2）。
 * 年収の手取りとは算定の土台が別（標準賞与額・算出率の表・住民税なし）なので、
 * 同じフォームには載せず独立した計算として置く。
 */
export default function BonusCalculator() {
  const [bonus, setBonus] = useState("500000");
  const [prevSalary, setPrevSalary] = useState("250000");
  const [isOver40, setIsOver40] = useState(false);

  const bonusError = useMemo(() => validateNumberInput(bonus, FIELD_RULES).error, [bonus]);
  const prevError = useMemo(() => validateNumberInput(prevSalary, FIELD_RULES).error, [prevSalary]);

  const outcome = useMemo(
    () =>
      bonusOutcome({
        bonusAmount: validateNumberInput(bonus, FIELD_RULES).value,
        previousMonthSalary: validateNumberInput(prevSalary, FIELD_RULES).value,
        isOver40,
      }),
    [bonus, prevSalary, isOver40],
  );

  return (
    <section
      className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
      aria-labelledby="bonus-heading"
    >
      <h3 id="bonus-heading" className="text-lg font-bold text-slate-800">
        賞与（ボーナス）の手取り
      </h3>
      <p className="mt-2 text-sm text-slate-600">
        賞与は毎月の給与と算定の土台が違います。標準賞与額（1,000円未満切捨）に料率を掛け、所得税は月額表ではなく
        <strong>賞与に対する源泉徴収税額の算出率の表</strong>で決まります。
        <strong>住民税は賞与から引かれません</strong>（前年所得をもとに毎月ほぼ定額で徴収されるため）。
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm font-medium text-slate-700">賞与の額面（円）</span>
          <input
            inputMode="numeric"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-right tabular-nums"
            value={bonus}
            onChange={(e) => setBonus(e.target.value)}
            aria-invalid={bonusError !== null}
            aria-describedby={bonusError ? "bonus-amount-error" : undefined}
          />
          {bonusError && (
            <p id="bonus-amount-error" role="alert" className="mt-1 text-xs text-rose-700">
              {bonusError}
            </p>
          )}
        </label>

        <label className="block">
          <span className="text-sm font-medium text-slate-700">
            前月の給与（社会保険料を引いた後・円）
          </span>
          <input
            inputMode="numeric"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-right tabular-nums"
            value={prevSalary}
            onChange={(e) => setPrevSalary(e.target.value)}
            aria-invalid={prevError !== null}
            aria-describedby={prevError ? "bonus-prev-error" : undefined}
          />
          {prevError && (
            <p id="bonus-prev-error" role="alert" className="mt-1 text-xs text-rose-700">
              {prevError}
            </p>
          )}
          <span className="mt-1 block text-xs text-slate-500">源泉徴収の税率がこの額で決まります</span>
        </label>
      </div>

      <label className="mt-3 flex items-start gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4 rounded border-slate-300"
          checked={isOver40}
          onChange={(e) => setIsOver40(e.target.checked)}
        />
        <span>40歳以上65歳未満（介護保険料がかかる）</span>
      </label>

      {outcome.kind === "unsupported" ? (
        <p role="alert" className="mt-5 rounded-lg bg-amber-50 p-4 text-sm text-amber-900">
          {BONUS_UNSUPPORTED_MESSAGE[outcome.reason]}
        </p>
      ) : (
        <div className="mt-5">
          <div className="rounded-xl border border-brand/30 bg-brand/5 p-4 text-center">
            <p className="text-sm text-slate-600">賞与の手取り</p>
            <p className="mt-1 text-3xl font-bold text-slate-900 tabular-nums">
              {yen(outcome.result.takeHome)}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              手取り率 {(outcome.result.takeHomeRate * 100).toFixed(1)}%
            </p>
          </div>

          <table className="mt-4 w-full text-sm">
            <caption className="sr-only">賞与から引かれるものの内訳</caption>
            <tbody>
              <tr className="border-b border-slate-100">
                <th scope="row" className="py-1.5 text-left font-normal text-slate-600">
                  標準賞与額（1,000円未満切捨）
                </th>
                <td className="py-1.5 text-right tabular-nums text-slate-800">
                  {yen(outcome.result.standardBonus)}
                </td>
              </tr>
              <tr className="border-b border-slate-100">
                <th scope="row" className="py-1.5 text-left font-normal text-slate-600">
                  健康保険・介護保険・子ども・子育て支援金
                </th>
                <td className="py-1.5 text-right tabular-nums text-slate-800">
                  {yen(outcome.result.healthNursingChildCareTotal)}
                </td>
              </tr>
              <tr className="border-b border-slate-100">
                <th scope="row" className="py-1.5 text-left font-normal text-slate-600">
                  厚生年金保険
                </th>
                <td className="py-1.5 text-right tabular-nums text-slate-800">
                  {yen(outcome.result.pensionInsurance)}
                </td>
              </tr>
              <tr className="border-b border-slate-100">
                <th scope="row" className="py-1.5 text-left font-normal text-slate-600">
                  雇用保険
                </th>
                <td className="py-1.5 text-right tabular-nums text-slate-800">
                  {yen(outcome.result.employmentInsurance)}
                </td>
              </tr>
              <tr className="border-b border-slate-100">
                <th scope="row" className="py-1.5 text-left font-normal text-slate-600">
                  所得税（税率 {outcome.result.withholdingRate.toFixed(3)}%・復興特別所得税込み）
                </th>
                <td className="py-1.5 text-right tabular-nums text-slate-800">
                  {yen(outcome.result.incomeTax)}
                </td>
              </tr>
              <tr className="border-b border-slate-100">
                <th scope="row" className="py-1.5 text-left font-normal text-slate-600">
                  住民税
                </th>
                <td className="py-1.5 text-right tabular-nums text-slate-500">
                  {yen(outcome.result.residentTax)}（賞与からは引かれない）
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-4 text-xs text-slate-500 leading-relaxed">
        扶養親族等0人・協会けんぽ（全国平均）・一般の事業の概算です。健康保険料率は都道府県で、健保組合はさらに別料率で変わります。同じ月に2回以上支給された場合は合算額を入力してください。
      </p>
    </section>
  );
}
