"use client";

import { useMemo, useState } from "react";
import {
  zaishokuPensionSuspension,
  SUSPENSION_THRESHOLD_SCHEDULE,
} from "@/lib/nenkin-kuriage/zaishoku";

const yen = (n: number) => `${Math.round(n).toLocaleString("ja-JP")}円`;
const toInt = (s: string) => Number(s.replace(/[^0-9]/g, "")) || 0;

/**
 * 在職老齢年金の支給停止（H6）。
 *
 * 働きながら受け取ると、基本月額と総報酬月額相当額の合計が基準額を超えた分の
 * 半分だけ年金が止まる。繰上げ・繰下げの損得はこの停止額で変わるのに、
 * lib/nenkin-kuriage/zaishoku.ts はどの画面からも呼ばれていなかった。
 */
export default function WorkingPension({ asOf }: { asOf: string }) {
  const [basicMonthly, setBasicMonthly] = useState("100000");
  const [compensation, setCompensation] = useState("500000");

  const result = useMemo(
    () =>
      zaishokuPensionSuspension(
        { basicMonthly: toInt(basicMonthly), totalCompensationMonthly: toInt(compensation) },
        asOf,
      ),
    [basicMonthly, compensation, asOf],
  );

  return (
    <section
      className="rounded-2xl border border-gray-200 bg-white p-5"
      aria-labelledby="zaishoku-heading"
    >
      <h3 id="zaishoku-heading" className="text-sm font-bold text-gray-800">
        働きながら受け取る場合（在職老齢年金）
      </h3>
      <p className="mt-2 text-xs text-gray-600 leading-relaxed">
        老齢厚生年金は、<strong>基本月額</strong>と<strong>総報酬月額相当額</strong>の合計が基準額を超えると、超えた分の
        <strong>半分</strong>が止まります。止まるのは老齢厚生年金だけで、老齢基礎年金は減りません。
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block text-xs text-gray-600">
          基本月額（加給年金を除く老齢厚生年金の年額 ÷ 12・円）
          <input
            inputMode="numeric"
            aria-label="基本月額"
            className="mt-1 block w-full rounded border border-gray-300 px-2 py-1 text-right tabular-nums"
            value={basicMonthly}
            onChange={(e) => setBasicMonthly(e.target.value)}
          />
        </label>
        <label className="block text-xs text-gray-600">
          総報酬月額相当額（標準報酬月額＋直近1年の標準賞与額 ÷ 12・円）
          <input
            inputMode="numeric"
            aria-label="総報酬月額相当額"
            className="mt-1 block w-full rounded border border-gray-300 px-2 py-1 text-right tabular-nums"
            value={compensation}
            onChange={(e) => setCompensation(e.target.value)}
          />
        </label>
      </div>

      <div
        className={`mt-4 rounded-lg p-3 text-sm ${
          result.suspended > 0 ? "bg-amber-50 text-amber-900" : "bg-emerald-50 text-emerald-900"
        }`}
        role="status"
      >
        {result.suspended > 0 ? (
          <p>
            月 <span className="font-bold tabular-nums">{yen(result.suspended)}</span> が停止され、
            受け取れるのは月 <span className="font-bold tabular-nums">{yen(result.paid)}</span> です
            {result.fullySuspended && <>（全部停止）</>}。
          </p>
        ) : (
          <p>
            合計が基準額以下なので<span className="font-bold">停止はありません</span>。月{" "}
            <span className="font-bold tabular-nums">{yen(result.paid)}</span> を全額受け取れます。
          </p>
        )}
        <p className="mt-1 text-xs">
          合計 {yen(result.combined)} ／ 基準額 {yen(result.threshold)}（{result.thresholdLabel}）
        </p>
      </div>

      <p className="mt-3 text-xs text-gray-400">
        基準額は年度で改定されます（
        {SUSPENSION_THRESHOLD_SCHEDULE.map((r) => `${r.label} ${yen(r.threshold)}`).join(" → ")}
        ）。判定日 {asOf} 時点の基準で計算しています。
      </p>
    </section>
  );
}
