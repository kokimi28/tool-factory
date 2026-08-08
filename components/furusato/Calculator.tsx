"use client";

import { useMemo, useState } from "react";
import {
  calcFurusatoLimit,
  estimateFurusatoLimitFromSalary,
} from "@/lib/furusato/calculations";
import { parseNonNegativeNumber as toNumber } from "@/lib/input";
import { FURUSATO_INCOME_PRESETS } from "@/lib/furusato/presets";

type Mode = "salary" | "taxable";

const yen = (n: number) => `${Math.round(n).toLocaleString("ja-JP")}円`;
const pct = (r: number) => `${Math.round(r * 100)}%`;

export default function Calculator() {
  const [mode, setMode] = useState<Mode>("salary");
  const [annualIncome, setAnnualIncome] = useState("6000000");
  const [hasSpouse, setHasSpouse] = useState(false);
  const [dependents, setDependents] = useState("0");
  const [taxableIncome, setTaxableIncome] = useState("3000000");

  const result = useMemo(() => {
    if (mode === "salary") {
      const r = estimateFurusatoLimitFromSalary({
        annualIncome: toNumber(annualIncome),
        hasSpouse,
        dependents: Math.max(0, Math.floor(toNumber(dependents))),
      });
      return { ...r, taxable: r.estimatedTaxableIncome, estimated: true };
    }
    const r = calcFurusatoLimit(toNumber(taxableIncome));
    return { ...r, taxable: toNumber(taxableIncome), estimated: false };
  }, [mode, annualIncome, hasSpouse, dependents, taxableIncome]);

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* モード切替 */}
      <div className="flex gap-2 mb-6" role="tablist" aria-label="入力方法">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "salary"}
          onClick={() => setMode("salary")}
          className={`flex-1 rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
            mode === "salary"
              ? "border-blue-500 bg-blue-50 text-blue-700"
              : "border-gray-200 text-gray-600 hover:border-gray-300"
          }`}
        >
          年収から概算
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "taxable"}
          onClick={() => setMode("taxable")}
          className={`flex-1 rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
            mode === "taxable"
              ? "border-blue-500 bg-blue-50 text-blue-700"
              : "border-gray-200 text-gray-600 hover:border-gray-300"
          }`}
        >
          課税所得から正確に
        </button>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
        {mode === "salary" ? (
          <>
            <label className="block">
              <span className="text-sm font-medium text-gray-800">額面年収</span>
              <div className="mt-1 flex items-center gap-2">
                <input
                  inputMode="numeric"
                  value={annualIncome}
                  onChange={(e) => setAnnualIncome(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-right"
                />
                <span className="text-gray-500">円</span>
              </div>
            </label>
            <div className="flex flex-wrap gap-2" role="group" aria-label="年収プリセット">
              {FURUSATO_INCOME_PRESETS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  className="rounded-full border border-gray-300 px-3 py-1 text-xs text-gray-600 transition hover:border-blue-400 hover:text-blue-700"
                  onClick={() => setAnnualIncome(String(p.value))}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={hasSpouse}
                  onChange={(e) => setHasSpouse(e.target.checked)}
                />
                配偶者控除の対象がいる
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                扶養人数（配偶者を除く）
                <input
                  inputMode="numeric"
                  value={dependents}
                  onChange={(e) => setDependents(e.target.value)}
                  className="w-16 rounded-lg border border-gray-300 px-2 py-1 text-right"
                />
                人
              </label>
            </div>
          </>
        ) : (
          <label className="block">
            <span className="text-sm font-medium text-gray-800">
              課税総所得金額（住民税決定通知書・源泉徴収票の「課税標準」）
            </span>
            <div className="mt-1 flex items-center gap-2">
              <input
                inputMode="numeric"
                value={taxableIncome}
                onChange={(e) => setTaxableIncome(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-right"
              />
              <span className="text-gray-500">円</span>
            </div>
          </label>
        )}
      </div>

      {/* 結果 */}
      <div className="mt-6 rounded-xl border border-blue-200 bg-blue-50 p-6 text-center">
        <p className="text-sm text-blue-700">
          自己負担2,000円で済む寄付額の上限（{result.estimated ? "概算" : "目安"}）
        </p>
        <p className="mt-1 text-3xl font-bold text-blue-900">{yen(result.limit)}</p>
        <dl className="mt-4 grid grid-cols-3 gap-2 text-xs text-blue-800">
          <div>
            <dt className="text-blue-600">課税総所得金額</dt>
            <dd className="font-semibold">{yen(result.taxable)}</dd>
          </div>
          <div>
            <dt className="text-blue-600">住民税所得割</dt>
            <dd className="font-semibold">{yen(result.residentLevy)}</dd>
          </div>
          <div>
            <dt className="text-blue-600">所得税の限界税率</dt>
            <dd className="font-semibold">{pct(result.marginalRate)}</dd>
          </div>
        </dl>
      </div>

      <p className="mt-4 text-xs text-gray-500 leading-relaxed">
        {result.estimated
          ? "年収からの概算は、社会保険料を年収の約14.75%とみなし、基礎控除・配偶者/扶養控除のみを考慮した簡易計算です。医療費控除・住宅ローン控除・iDeCo 等がある場合は上限が変わります。より正確には「課税所得から正確に」タブで住民税決定通知書の課税総所得金額を入力してください。"
          : "課税総所得金額（住民税の課税標準）を入力した目安です。ふるさと納税以外の寄付金控除がある場合は上限が変わります。"}
        {" "}本サイトの計算結果は概算・参考値です。実際の控除額はお住まいの自治体でご確認ください。
      </p>
    </div>
  );
}
