"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  pensionScenario,
  breakEvenAgeVs65,
  monthsFrom65,
  ratePerMonth,
} from "@/lib/nenkin-kuriage/calculations";
import { netScenario } from "@/lib/nenkin-kuriage/net";
import { PENSION_MONTHLY_PRESETS } from "@/lib/nenkin-kuriage/presets";
import { clampStartAge } from "@/lib/nenkin-kuriage/share";
import { resultToClipboardText } from "@/lib/nenkin-kuriage/result-text";
import CopyResult from "@/components/nenkin-kuriage/CopyResult";
import { encodeShareParams, decodeShareParams } from "@/lib/share-url";
import { parseNonNegativeNumber as toNumber } from "@/lib/input";
import { validateNumberInput } from "@/lib/validate-input";

const yen = (n: number) => `${Math.round(n).toLocaleString("ja-JP")}円`;
const pct = (r: number) => `${(r * 100).toFixed(1)}%`;

const AGES = [60, 62, 65, 66, 68, 70, 72, 75];

export default function Calculator() {
  const [baseMonthly, setBaseMonthly] = useState("150000");
  const [startAge, setStartAge] = useState(70);
  // 手取り（税引後）で見るモード。既定は額面のまま（従来の挙動）。
  const [netMode, setNetMode] = useState(false);
  // 国保・介護保険料は自治体で決まるので、見たい人だけが入れる任意入力。
  const [insuranceFlat, setInsuranceFlat] = useState("0");
  const [insuranceRate, setInsuranceRate] = useState("0");
  const hydrated = useRef(false);
  const [copied, setCopied] = useState(false);

  // マウント時に URL のクエリから入力を復元（共有リンクで同じ結果を再現）。
  useEffect(() => {
    const p = decodeShareParams(window.location.search);
    if (p.base) setBaseMonthly(String(toNumber(p.base)));
    if (p.age) setStartAge(clampStartAge(Number(p.age)));
    hydrated.current = true;
  }, []);

  // 入力が変わったら URL に反映（履歴を汚さない replaceState）。復元完了後のみ。
  useEffect(() => {
    if (!hydrated.current) return;
    const qs = encodeShareParams({
      base: String(toNumber(baseMonthly)),
      age: String(startAge),
    });
    window.history.replaceState(null, "", qs || window.location.pathname);
  }, [baseMonthly, startAge]);

  async function copyShareLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // クリップボード不可の環境では何もしない（URL は既にアドレスバーに反映済み）。
    }
  }

  const base = toNumber(baseMonthly);
  // E9: 年金月額入力の妥当性メッセージ（負値・非数字・上限超過を通知）。
  const baseError = useMemo(
    () => validateNumberInput(baseMonthly, { max: 1_000_000 }).error,
    [baseMonthly],
  );
  const scenario = useMemo(() => pensionScenario(base, startAge), [base, startAge]);
  const breakEven = useMemo(() => breakEvenAgeVs65(startAge), [startAge]);

  const netOptions = useMemo(
    () => ({
      socialInsurance: toNumber(insuranceFlat),
      socialInsuranceRate: toNumber(insuranceRate) / 100,
    }),
    [insuranceFlat, insuranceRate],
  );
  const net = useMemo(
    () => netScenario(base, startAge, netOptions),
    [base, startAge, netOptions],
  );

  const rows = useMemo(
    () =>
      AGES.map((a) => ({
        age: a,
        ...pensionScenario(base, a),
        be: breakEvenAgeVs65(a),
        netBe: netScenario(base, a, netOptions).breakEven,
        netAnnual: netScenario(base, a, netOptions).from65.net,
      })),
    [base, netOptions],
  );

  const kind =
    startAge < 65 ? "繰上げ（減額）" : startAge > 65 ? "繰下げ（増額）" : "通常（65歳）";

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
        <label className="block">
          <span className="text-sm font-medium text-gray-800">65歳で受け取る場合の年金月額</span>
          <div className="mt-1 flex items-center gap-2">
            <input
              inputMode="numeric"
              value={baseMonthly}
              onChange={(e) => setBaseMonthly(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-right"
              aria-invalid={baseError !== null}
              aria-describedby={baseError ? "nenkin-base-error" : undefined}
            />
            <span className="text-gray-500">円</span>
          </div>
          {baseError && (
            <p id="nenkin-base-error" role="alert" className="mt-1 text-xs text-rose-600">
              {baseError}
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="年金月額プリセット">
            {PENSION_MONTHLY_PRESETS.map((p) => (
              <button
                key={p.value}
                type="button"
                className="rounded-full border border-gray-300 px-3 py-1 text-xs text-gray-600 transition hover:border-indigo-400 hover:text-indigo-700"
                onClick={() => setBaseMonthly(String(p.value))}
              >
                {p.label}
              </button>
            ))}
          </div>
        </label>

        <label className="block">
          <span className="text-sm font-medium text-gray-800">
            受給開始年齢：<span className="font-bold text-indigo-700">{startAge}歳</span>（{kind}）
          </span>
          <input
            type="range"
            min={60}
            max={75}
            step={1}
            value={startAge}
            onChange={(e) => setStartAge(Number(e.target.value))}
            className="mt-2 w-full"
          />
          <div className="flex justify-between text-xs text-gray-400">
            <span>60歳</span>
            <span>65歳</span>
            <span>75歳</span>
          </div>
        </label>

        <div className="border-t border-gray-100 pt-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={netMode}
              onChange={(e) => setNetMode(e.target.checked)}
              className="h-4 w-4"
            />
            <span className="text-sm font-medium text-gray-800">
              税引後（手取り）で見る
            </span>
          </label>
          <p className="mt-1 text-xs text-gray-500">
            所得税・復興特別所得税・住民税を差し引きます（65歳以上・他に所得なし・単身の前提）。
          </p>

          {netMode && (
            <details className="mt-3 rounded-lg bg-gray-50 p-3">
              <summary className="cursor-pointer text-xs font-medium text-gray-700">
                国民健康保険料・介護保険料も入れる（任意）
              </summary>
              <p className="mt-2 text-xs text-gray-500">
                保険料は市区町村ごとに決まるため計算に含めていません。お手元の通知書の額を入れると反映されます。
              </p>
              <div className="mt-2 grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs text-gray-600">定額部分（円/年）</span>
                  <input
                    inputMode="numeric"
                    value={insuranceFlat}
                    onChange={(e) => setInsuranceFlat(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1 text-right text-sm"
                  />
                </label>
                <label className="block">
                  <span className="text-xs text-gray-600">所得比例部分（％）</span>
                  <input
                    inputMode="decimal"
                    value={insuranceRate}
                    onChange={(e) => setInsuranceRate(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1 text-right text-sm"
                  />
                </label>
              </div>
            </details>
          )}
        </div>
      </div>

      {/* この開始年齢のサマリ */}
      <div className="mt-6 rounded-xl border border-indigo-200 bg-indigo-50 p-6 text-center">
        <p className="text-sm text-indigo-700">
          {startAge}歳から受給した場合の{netMode ? "手取り" : ""}月額（受給率 {pct(scenario.rate)}）
        </p>
        <p className="mt-1 text-3xl font-bold text-indigo-900">
          {yen(netMode ? net.from65.net / 12 : scenario.monthly)}
        </p>
        <p className="mt-1 text-sm text-indigo-700">
          年額 {yen(netMode ? net.from65.net : scenario.annual)}
          {netMode && (
            <span className="text-indigo-600">
              {" "}
              （額面 {yen(scenario.annual)}／税・保険料 {yen(net.from65.totalTax + net.from65.socialInsurance)}）
            </span>
          )}
        </p>
        {netMode && net.differsBefore65 && (
          <p className="mt-1 text-xs text-indigo-600">
            65歳になるまでは公的年金等控除の下限が低いため、手取りは年 {yen(net.atStart.net)} です。
          </p>
        )}
        {netMode ? (
          net.breakEven.years !== null ? (
            <p className="mt-3 text-sm text-indigo-800">
              65歳受給との損益分岐は
              <span className="font-bold">
                {" "}
                {net.breakEven.years}歳{net.breakEven.months}か月
              </span>
              （額面なら {breakEven.years}歳{breakEven.months}か月）。
              {startAge < 65 ? "これより長生きすると65歳受給の方が有利。" : "これより長生きすると繰下げの方が有利。"}
            </p>
          ) : (
            <p className="mt-3 text-sm text-indigo-800">65歳受給（基準）です。</p>
          )
        ) : breakEven.years !== null ? (
          <p className="mt-3 text-sm text-indigo-800">
            65歳受給との損益分岐は
            <span className="font-bold">
              {" "}
              {breakEven.years}歳{breakEven.months}か月
            </span>
            。{startAge < 65 ? "これより長生きすると65歳受給の方が有利。" : "これより長生きすると繰下げの方が有利。"}
          </p>
        ) : (
          <p className="mt-3 text-sm text-indigo-800">65歳受給（基準）です。</p>
        )}
      </div>

      {/* 受給率の内訳（E4）: 月数 × 適用率で受給率を段階表示 */}
      <details className="mt-6 rounded-xl border border-gray-200 bg-white p-5">
        <summary className="cursor-pointer text-sm font-medium text-gray-700 hover:text-gray-900">
          受給率の内訳（詳しく）
        </summary>
        <ol className="mt-3 space-y-2 text-sm text-gray-700">
          <li>
            <span className="text-gray-500">① 65歳からの月数：</span>{" "}
            <span className="font-semibold tabular-nums">
              {monthsFrom65(startAge) >= 0 ? "＋" : "−"}
              {Math.abs(monthsFrom65(startAge))}か月
            </span>
          </li>
          <li>
            <span className="text-gray-500">
              ② 適用率（{startAge < 65 ? "繰上げ" : startAge > 65 ? "繰下げ" : "基準"}）：
            </span>{" "}
            <span className="font-semibold tabular-nums">
              {startAge === 65 ? "—" : `1か月あたり ${(ratePerMonth(startAge) * 100).toFixed(1)}%`}
            </span>
          </li>
          <li>
            <span className="text-gray-500">③ 受給率 ＝ 1 ＋ 月数 × 適用率：</span>{" "}
            <span className="font-semibold tabular-nums">{pct(scenario.rate)}</span>
          </li>
          <li>
            <span className="text-gray-500">④ 月額 ＝ 基準月額 × 受給率：</span>{" "}
            <span className="font-semibold tabular-nums">{yen(scenario.monthly)}</span>（年額 {yen(scenario.annual)}）
          </li>
        </ol>
        <p className="mt-2 text-xs text-gray-400">
          繰上げは1か月あたり0.4%減額（60歳で−24%）、繰下げは1か月あたり0.7%増額（75歳で+84%）。1円未満は切り捨て。
        </p>
      </details>

      {/* 年齢別の比較テーブル */}
      <div className="mt-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-gray-500">
              <th className="py-2 pr-2 font-medium">開始年齢</th>
              <th className="py-2 px-2 font-medium">受給率</th>
              <th className="py-2 px-2 font-medium text-right">{netMode ? "手取り月額" : "月額"}</th>
              <th className="py-2 pl-2 font-medium text-right">65歳との損益分岐</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.age}
                className={`border-b border-gray-100 ${r.age === startAge ? "bg-indigo-50" : ""}`}
              >
                <td className="py-1.5 pr-2">{r.age}歳</td>
                <td className="py-1.5 px-2">{pct(r.rate)}</td>
                <td className="py-1.5 px-2 text-right tabular-nums">
                  {yen(netMode ? r.netAnnual / 12 : r.monthly)}
                </td>
                <td className="py-1.5 pl-2 text-right tabular-nums">
                  {netMode
                    ? r.netBe.years !== null
                      ? `${r.netBe.years}歳${r.netBe.months}か月`
                      : "—"
                    : r.be.years !== null
                      ? `${r.be.years}歳${r.be.months}か月`
                      : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 結果の共有（E3）＋テキストコピー（E12） */}
      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
        <button
          type="button"
          onClick={copyShareLink}
          aria-live="polite"
          className="text-sm font-medium text-indigo-700 underline underline-offset-2 hover:text-indigo-800"
        >
          {copied ? "リンクをコピーしました" : "この結果のリンクをコピー"}
        </button>
        <CopyResult text={resultToClipboardText(scenario, breakEven)} />
      </div>

      <p className="mt-4 text-xs text-gray-500 leading-relaxed">
        繰上げは1か月あたり0.4%減額（60歳で−24%）、繰下げは1か月あたり0.7%増額（75歳で+84%）で計算しています（昭和37年4月2日以降生まれ）。
        {netMode
          ? "手取りは公的年金等控除（所得税法35条4項・租税特別措置法41条の15の3）を差し引いた雑所得に、所得税・復興特別所得税と住民税（所得割10%・基礎控除43万円・均等割5,000円）をかけて計算しています。他に所得がなく単身の前提で、住民税は標準税率です。均等割・非課税限度額は自治体で変わります。損益分岐年齢は額面と違い年金額によって変わります。国民健康保険料・介護保険料は上の任意入力を使わないかぎり含みません。"
          : "損益分岐年齢は累計受給額が65歳受給に追いつく年齢で、年金額に関わらず受給率だけで決まります。税・社会保険料は含めていません（「税引後（手取り）で見る」で切り替えられます）。"}
        加給年金・振替加算・在職老齢年金は含めていません。本サイトの計算結果は概算・参考値です。
      </p>
    </div>
  );
}
