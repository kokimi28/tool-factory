"use client";

import { useMemo, useState } from "react";
import {
  calcHomeLoanDeduction,
  type HousingType,
} from "@/lib/jutaku-loan/calculations";
import { parseNonNegativeNumber as toNumber } from "@/lib/input";
import { JUTAKU_LOAN_PRESETS } from "@/lib/jutaku-loan/presets";
import PrincipalScenarioTable from "@/components/jutaku-loan/PrincipalScenarioTable";

const yen = (n: number) => `${Math.round(n).toLocaleString("ja-JP")}円`;

const HOUSING_OPTIONS: { value: HousingType; label: string }[] = [
  { value: "long_term", label: "認定長期優良住宅・低炭素住宅（新築・13年）" },
  { value: "zeh", label: "ZEH水準省エネ住宅（新築・13年）" },
  { value: "energy_saving", label: "省エネ基準適合住宅（新築・13年）" },
  { value: "existing_certified", label: "中古・認定住宅等（10年）" },
  { value: "existing_other", label: "中古・その他（10年）" },
];

export default function Calculator() {
  const [principal, setPrincipal] = useState("35000000");
  const [rate, setRate] = useState("1.0");
  const [years, setYears] = useState("35");
  const [housingType, setHousingType] = useState<HousingType>("zeh");
  const [childRearing, setChildRearing] = useState(false);

  const result = useMemo(
    () =>
      calcHomeLoanDeduction({
        principal: toNumber(principal),
        annualRatePercent: toNumber(rate),
        years: Math.max(1, Math.floor(toNumber(years))),
        housingType,
        childRearingHousehold: childRearing,
      }),
    [principal, rate, years, housingType, childRearing],
  );

  const isNewBuild = housingType.startsWith("existing") === false;

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
        <label className="block">
          <span className="text-sm font-medium text-gray-800">借入額</span>
          <div className="mt-1 flex items-center gap-2">
            <input
              inputMode="numeric"
              value={principal}
              onChange={(e) => setPrincipal(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-right"
            />
            <span className="text-gray-500">円</span>
          </div>
          <input
            type="range"
            min={10_000_000}
            max={60_000_000}
            step={1_000_000}
            value={Math.min(60_000_000, Math.max(10_000_000, toNumber(principal)))}
            onChange={(e) => setPrincipal(e.target.value)}
            className="mt-2 w-full"
            aria-label="借入額スライダー"
          />
          <div className="flex justify-between text-xs text-gray-400">
            <span>1,000万円</span>
            <span>6,000万円</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="借入額プリセット">
            {JUTAKU_LOAN_PRESETS.map((p) => (
              <button
                key={p.value}
                type="button"
                className="rounded-full border border-gray-300 px-3 py-1 text-xs text-gray-600 transition hover:border-emerald-400 hover:text-emerald-700"
                onClick={() => setPrincipal(String(p.value))}
              >
                {p.label}
              </button>
            ))}
          </div>
        </label>

        <div className="flex gap-4">
          <label className="block flex-1">
            <span className="text-sm font-medium text-gray-800">金利（年）</span>
            <div className="mt-1 flex items-center gap-2">
              <input
                inputMode="decimal"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-right"
              />
              <span className="text-gray-500">%</span>
            </div>
          </label>
          <label className="block flex-1">
            <span className="text-sm font-medium text-gray-800">返済期間</span>
            <div className="mt-1 flex items-center gap-2">
              <input
                inputMode="numeric"
                value={years}
                onChange={(e) => setYears(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-right"
              />
              <span className="text-gray-500">年</span>
            </div>
          </label>
        </div>

        <label className="block">
          <span className="text-sm font-medium text-gray-800">住宅の種類（環境性能）</span>
          <select
            value={housingType}
            onChange={(e) => setHousingType(e.target.value as HousingType)}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
          >
            {HOUSING_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        {isNewBuild && (
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={childRearing}
              onChange={(e) => setChildRearing(e.target.checked)}
            />
            子育て世帯・若者夫婦世帯（2024年入居の借入限度額の上乗せ）
          </label>
        )}
      </div>

      {/* 結果サマリ */}
      <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center">
        <p className="text-sm text-emerald-700">
          控除見込み総額（{result.years}年間・概算）
        </p>
        <p className="mt-1 text-3xl font-bold text-emerald-900">
          {yen(result.totalDeduction)}
        </p>
        <dl className="mt-4 grid grid-cols-3 gap-2 text-xs text-emerald-800">
          <div>
            <dt className="text-emerald-600">借入限度額</dt>
            <dd className="font-semibold">{yen(result.limit)}</dd>
          </div>
          <div>
            <dt className="text-emerald-600">控除期間</dt>
            <dd className="font-semibold">{result.years}年</dd>
          </div>
          <div>
            <dt className="text-emerald-600">毎月返済額</dt>
            <dd className="font-semibold">{yen(result.monthlyPayment)}</dd>
          </div>
        </dl>
      </div>

      {/* 年別内訳 */}
      <div className="mt-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-gray-500">
              <th className="py-2 pr-2 font-medium">年</th>
              <th className="py-2 px-2 font-medium text-right">年末残高</th>
              <th className="py-2 px-2 font-medium text-right">対象残高</th>
              <th className="py-2 pl-2 font-medium text-right">控除額</th>
            </tr>
          </thead>
          <tbody>
            {result.schedule.map((row) => (
              <tr key={row.year} className="border-b border-gray-100">
                <td className="py-1.5 pr-2">{row.year}年目</td>
                <td className="py-1.5 px-2 text-right tabular-nums">{yen(row.yearEndBalance)}</td>
                <td className="py-1.5 px-2 text-right tabular-nums">{yen(row.eligibleBalance)}</td>
                <td className="py-1.5 pl-2 text-right font-semibold tabular-nums">{yen(row.deduction)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 借入額を振ったときの返済と控除の同時比較（E8） */}
      <div className="mt-6">
        <PrincipalScenarioTable
          annualRatePercent={toNumber(rate)}
          years={Math.max(1, Math.floor(toNumber(years)))}
          housingType={housingType}
          childRearingHousehold={childRearing}
        />
      </div>

      <p className="mt-4 text-xs text-gray-500 leading-relaxed">
        各年の控除額は「min(年末残高, 借入限度額) × 0.7%」の概算です。実際に受けられる控除は、
        その年の所得税額＋住民税からの控除上限（課税総所得金額×5%・最大97,500円）が上限になり、
        残高×0.7% を使い切れないこともあります。所得要件・床面積要件・入居年による限度額の違いは
        考慮していません。正確な額は国税庁・税務署でご確認ください。本サイトの計算結果は概算・参考値です。
      </p>
    </div>
  );
}
