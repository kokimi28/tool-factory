"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  pensionScenario,
  breakEvenAgeVs65,
  monthsFrom65,
  ratePerMonth,
} from "@/lib/nenkin-kuriage/calculations";
import { PENSION_MONTHLY_PRESETS } from "@/lib/nenkin-kuriage/presets";
import { clampStartAge } from "@/lib/nenkin-kuriage/share";
import { encodeShareParams, decodeShareParams } from "@/lib/share-url";
import { parseNonNegativeNumber as toNumber } from "@/lib/input";

const yen = (n: number) => `${Math.round(n).toLocaleString("ja-JP")}円`;
const pct = (r: number) => `${(r * 100).toFixed(1)}%`;

const AGES = [60, 62, 65, 66, 68, 70, 72, 75];

export default function Calculator() {
  const [baseMonthly, setBaseMonthly] = useState("150000");
  const [startAge, setStartAge] = useState(70);
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
  const scenario = useMemo(() => pensionScenario(base, startAge), [base, startAge]);
  const breakEven = useMemo(() => breakEvenAgeVs65(startAge), [startAge]);

  const rows = useMemo(
    () => AGES.map((a) => ({ age: a, ...pensionScenario(base, a), be: breakEvenAgeVs65(a) })),
    [base],
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
            />
            <span className="text-gray-500">円</span>
          </div>
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
      </div>

      {/* この開始年齢のサマリ */}
      <div className="mt-6 rounded-xl border border-indigo-200 bg-indigo-50 p-6 text-center">
        <p className="text-sm text-indigo-700">
          {startAge}歳から受給した場合の月額（受給率 {pct(scenario.rate)}）
        </p>
        <p className="mt-1 text-3xl font-bold text-indigo-900">{yen(scenario.monthly)}</p>
        <p className="mt-1 text-sm text-indigo-700">年額 {yen(scenario.annual)}</p>
        {breakEven.years !== null ? (
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
              <th className="py-2 px-2 font-medium text-right">月額</th>
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
                <td className="py-1.5 px-2 text-right tabular-nums">{yen(r.monthly)}</td>
                <td className="py-1.5 pl-2 text-right tabular-nums">
                  {r.be.years !== null ? `${r.be.years}歳${r.be.months}か月` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 結果の共有（E3） */}
      <div className="mt-4">
        <button
          type="button"
          onClick={copyShareLink}
          aria-live="polite"
          className="text-sm font-medium text-indigo-700 underline underline-offset-2 hover:text-indigo-800"
        >
          {copied ? "リンクをコピーしました" : "この結果のリンクをコピー"}
        </button>
      </div>

      <p className="mt-4 text-xs text-gray-500 leading-relaxed">
        繰上げは1か月あたり0.4%減額（60歳で−24%）、繰下げは1か月あたり0.7%増額（75歳で+84%）で計算しています（昭和37年4月2日以降生まれ）。損益分岐年齢は累計受給額が65歳受給に追いつく年齢で、年金額に関わらず受給率だけで決まります。加給年金・振替加算・在職老齢年金・税・社会保険料は含めていません。本サイトの計算結果は概算・参考値です。
      </p>
    </div>
  );
}
