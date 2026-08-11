"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  calcFurusatoLimit,
  estimateFurusatoLimitFromSalary,
} from "@/lib/furusato/calculations";
import { parseNonNegativeNumber as toNumber } from "@/lib/input";
import { validateNumberInput } from "@/lib/validate-input";
import { FURUSATO_INCOME_PRESETS } from "@/lib/furusato/presets";
import { encodeShareParams, decodeShareParams } from "@/lib/share-url";
import { parseMode, boolToFlag, flagToBool, type Mode } from "@/lib/furusato/share";
import { resultToClipboardText } from "@/lib/furusato/result-text";
import CopyResult from "@/components/furusato/CopyResult";

const yen = (n: number) => `${Math.round(n).toLocaleString("ja-JP")}円`;
const pct = (r: number) => `${Math.round(r * 100)}%`;

export default function Calculator() {
  const [mode, setMode] = useState<Mode>("salary");
  const [annualIncome, setAnnualIncome] = useState("6000000");
  const [hasSpouse, setHasSpouse] = useState(false);
  const [dependents, setDependents] = useState("0");
  const [otherDeductions, setOtherDeductions] = useState("0");
  const [taxableIncome, setTaxableIncome] = useState("3000000");
  const hydrated = useRef(false);
  const [copied, setCopied] = useState(false);

  // マウント時に URL のクエリから入力を復元（共有リンクで同じ結果を再現）。
  useEffect(() => {
    const p = decodeShareParams(window.location.search);
    if (p.mode) setMode(parseMode(p.mode));
    if (p.income) setAnnualIncome(String(toNumber(p.income)));
    if (p.spouse) setHasSpouse(flagToBool(p.spouse));
    if (p.deps) setDependents(String(Math.max(0, Math.floor(toNumber(p.deps)))));
    if (p.other) setOtherDeductions(String(toNumber(p.other)));
    if (p.taxable) setTaxableIncome(String(toNumber(p.taxable)));
    hydrated.current = true;
  }, []);

  // 入力が変わったら URL に反映（履歴を汚さない replaceState）。復元完了後のみ。
  useEffect(() => {
    if (!hydrated.current) return;
    const qs = encodeShareParams({
      mode,
      income: String(toNumber(annualIncome)),
      spouse: boolToFlag(hasSpouse),
      deps: String(Math.max(0, Math.floor(toNumber(dependents)))),
      other: String(toNumber(otherDeductions)),
      taxable: String(toNumber(taxableIncome)),
    });
    window.history.replaceState(null, "", qs || window.location.pathname);
  }, [mode, annualIncome, hasSpouse, dependents, otherDeductions, taxableIncome]);

  async function copyShareLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // クリップボード不可の環境では何もしない（URL は既にアドレスバーに反映済み）。
    }
  }

  // E9: 主要な金額入力の妥当性メッセージ（負値・非数字・上限超過を通知）。
  // QC12 の silent clamp（parseNonNegativeNumber）を補完し「なぜ 0 になったか」を伝える。
  const incomeError = useMemo(
    () => validateNumberInput(annualIncome, { max: 100_000_000 }).error,
    [annualIncome],
  );
  const taxableError = useMemo(
    () => validateNumberInput(taxableIncome, { max: 100_000_000 }).error,
    [taxableIncome],
  );

  const result = useMemo(() => {
    if (mode === "salary") {
      const r = estimateFurusatoLimitFromSalary({
        annualIncome: toNumber(annualIncome),
        hasSpouse,
        dependents: Math.max(0, Math.floor(toNumber(dependents))),
        otherDeductions: toNumber(otherDeductions),
      });
      return { ...r, taxable: r.estimatedTaxableIncome, estimated: true };
    }
    const r = calcFurusatoLimit(toNumber(taxableIncome));
    return { ...r, taxable: toNumber(taxableIncome), estimated: false };
  }, [mode, annualIncome, hasSpouse, dependents, otherDeductions, taxableIncome]);

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
                  aria-invalid={incomeError !== null}
                  aria-describedby={incomeError ? "furusato-income-error" : undefined}
                />
                <span className="text-gray-500">円</span>
              </div>
              {incomeError && (
                <p id="furusato-income-error" role="alert" className="mt-1 text-xs text-rose-600">
                  {incomeError}
                </p>
              )}
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
            <label className="block">
              <span className="text-sm font-medium text-gray-800">
                その他の所得控除（iDeCo・医療費・生命保険料など・任意）
              </span>
              <div className="mt-1 flex items-center gap-2">
                <input
                  inputMode="numeric"
                  value={otherDeductions}
                  onChange={(e) => setOtherDeductions(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-right"
                />
                <span className="text-gray-500">円</span>
              </div>
              <span className="mt-1 block text-xs text-gray-500">
                iDeCoの年間掛金・医療費控除・生命保険料控除などの合計を入れると、課税所得が下がり限度額も下がります（未入力なら0）。
              </span>
            </label>
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
                aria-invalid={taxableError !== null}
                aria-describedby={taxableError ? "furusato-taxable-error" : undefined}
              />
              <span className="text-gray-500">円</span>
            </div>
            {taxableError && (
              <p id="furusato-taxable-error" role="alert" className="mt-1 text-xs text-rose-600">
                {taxableError}
              </p>
            )}
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

      {/* 計算の内訳（E4）: 総務省の式に実数を当てはめて段階表示 */}
      <details className="mt-4 rounded-lg border border-gray-200 bg-white p-4">
        <summary className="cursor-pointer text-sm font-medium text-gray-700 hover:text-gray-900">
          計算の内訳（詳しく）
        </summary>
        <ol className="mt-3 space-y-2 text-sm text-gray-700">
          {result.estimated && (
            <li>
              <span className="text-gray-500">① 年収から課税総所得金額を概算：</span>{" "}
              <span className="font-semibold tabular-nums">{yen(result.taxable)}</span>
            </li>
          )}
          <li>
            <span className="text-gray-500">
              {result.estimated ? "②" : "①"} 住民税所得割 ＝ 課税総所得 × 10%：
            </span>{" "}
            <span className="font-semibold tabular-nums">{yen(result.residentLevy)}</span>
          </li>
          <li>
            <span className="text-gray-500">
              {result.estimated ? "③" : "②"} 所得税の限界税率：
            </span>{" "}
            <span className="font-semibold tabular-nums">{pct(result.marginalRate)}</span>
          </li>
          <li>
            <span className="text-gray-500">
              {result.estimated ? "④" : "③"} 控除上限 ＝ 住民税所得割 × 20% ÷（90% − 限界税率 × 1.021）＋ 2,000円：
            </span>{" "}
            <span className="font-semibold tabular-nums">{yen(result.limit)}</span>
          </li>
        </ol>
        <p className="mt-2 text-xs text-gray-400">
          総務省「ふるさと納税のしくみ（控除上限額）」の計算式に基づく概算です。自己負担 2,000 円で済む年間寄付額の目安を表します。
        </p>
      </details>

      {/* 結果の共有（E3）＋テキストコピー（E12） */}
      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
        <button
          type="button"
          onClick={copyShareLink}
          aria-live="polite"
          className="text-sm font-medium text-blue-700 underline underline-offset-2 hover:text-blue-800"
        >
          {copied ? "リンクをコピーしました" : "この結果のリンクをコピー"}
        </button>
        <CopyResult text={resultToClipboardText({ ...result, taxable: result.taxable })} />
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
