"use client";

import { useMemo, useState } from "react";
import {
  takeHomeWithWall,
  analyzeWallReversal,
  type SiWall,
} from "@/lib/nenshu-kabe/calculations";
import { parseNonNegativeNumber as toNumber } from "@/lib/input";
import { NENSHU_KABE_PRESETS } from "@/lib/nenshu-kabe/presets";
import WallCurveTable from "@/components/nenshu-kabe/WallCurveTable";

const yen = (n: number) => `${Math.round(n).toLocaleString("ja-JP")}円`;
const man = (n: number) => `${Math.round(n / 10000).toLocaleString("ja-JP")}万円`;

export default function Calculator() {
  const [wall, setWall] = useState<SiWall>(1_300_000);
  const [income, setIncome] = useState("1400000");

  const reversal = useMemo(() => analyzeWallReversal(wall), [wall]);
  const current = useMemo(
    () => takeHomeWithWall(toNumber(income), wall),
    [income, wall],
  );

  // 壁の前後の比較（壁−1万 / 壁 / 回復年収）
  const rows = useMemo(() => {
    const points = [wall - 10_000, wall, reversal.recoveryIncome];
    return points.map((p) => takeHomeWithWall(p, wall));
  }, [wall, reversal.recoveryIncome]);

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
        <div>
          <span className="text-sm font-medium text-gray-800">適用される社会保険の壁</span>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => setWall(1_060_000)}
              className={`flex-1 rounded-lg border px-3 py-2 text-sm ${
                wall === 1_060_000
                  ? "border-rose-500 bg-rose-50 text-rose-700"
                  : "border-gray-200 text-gray-600"
              }`}
            >
              106万円の壁<br />
              <span className="text-xs">（特定適用事業所など）</span>
            </button>
            <button
              type="button"
              onClick={() => setWall(1_300_000)}
              className={`flex-1 rounded-lg border px-3 py-2 text-sm ${
                wall === 1_300_000
                  ? "border-rose-500 bg-rose-50 text-rose-700"
                  : "border-gray-200 text-gray-600"
              }`}
            >
              130万円の壁<br />
              <span className="text-xs">（それ以外・扶養から外れる）</span>
            </button>
          </div>
        </div>

        <label className="block">
          <span className="text-sm font-medium text-gray-800">本人の年収</span>
          <div className="mt-1 flex items-center gap-2">
            <input
              inputMode="numeric"
              value={income}
              onChange={(e) => setIncome(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-right"
            />
            <span className="text-gray-500">円</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="年収プリセット">
            {NENSHU_KABE_PRESETS.map((p) => (
              <button
                key={p.value}
                type="button"
                className="rounded-full border border-gray-300 px-3 py-1 text-xs text-gray-600 transition hover:border-rose-400 hover:text-rose-700"
                onClick={() => setIncome(String(p.value))}
              >
                {p.label}
              </button>
            ))}
          </div>
        </label>
      </div>

      {/* この年収の手取り */}
      <div className="mt-6 rounded-xl border border-rose-200 bg-rose-50 p-6 text-center">
        <p className="text-sm text-rose-700">
          年収 {man(current.income)} の手取り（{current.enrolled ? "社会保険 加入" : "扶養内・未加入"}）
        </p>
        <p className="mt-1 text-3xl font-bold text-rose-900">{yen(current.takeHome)}</p>
        <dl className="mt-4 grid grid-cols-3 gap-2 text-xs text-rose-800">
          <div>
            <dt className="text-rose-600">社会保険料</dt>
            <dd className="font-semibold">{yen(current.socialInsurance)}</dd>
          </div>
          <div>
            <dt className="text-rose-600">所得税</dt>
            <dd className="font-semibold">{yen(current.incomeTax)}</dd>
          </div>
          <div>
            <dt className="text-rose-600">住民税</dt>
            <dd className="font-semibold">{yen(current.residentTax)}</dd>
          </div>
        </dl>
      </div>

      {/* 逆転サマリ */}
      <div className="mt-6 rounded-xl border border-gray-200 bg-white p-5">
        <p className="text-sm text-gray-800">
          {man(wall)}の壁を超えると、社会保険料の発生で手取りが
          <span className="font-bold text-rose-700"> 約{yen(reversal.dropAtWall)} </span>
          下がります。
        </p>
        <p className="mt-2 text-sm text-gray-800">
          手取りが壁の直前（{yen(reversal.takeHomeJustBelow)}）まで戻るのは
          <span className="font-bold text-gray-900"> 年収 {yen(reversal.recoveryIncome)} </span>
          （壁から <span className="font-bold">+{yen(reversal.extraIncomeToRecover)}</span>）。
          この間は「働いても手取りが増えない」ゾーンです。
        </p>
      </div>

      {/* 比較テーブル */}
      <div className="mt-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-gray-500">
              <th className="py-2 pr-2 font-medium">年収</th>
              <th className="py-2 px-2 font-medium">社保</th>
              <th className="py-2 pl-2 font-medium text-right">手取り</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.income} className="border-b border-gray-100">
                <td className="py-1.5 pr-2 tabular-nums">{yen(r.income)}</td>
                <td className="py-1.5 px-2">{r.enrolled ? "加入" : "扶養内"}</td>
                <td className="py-1.5 pl-2 text-right font-semibold tabular-nums">{yen(r.takeHome)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 壁をまたぐ手取り曲線（壁の上下に広げたデータ表・E6） */}
      <div className="mt-6">
        <WallCurveTable wall={wall} />
      </div>

      <p className="mt-4 text-xs text-gray-500 leading-relaxed">
        本ツールは「本人」の手取りを、tedori（年収の手取り計算）と同じ計算で算定しています。壁の下では本人の社会保険料は0（扶養内）、壁以上では社会保険に加入する前提です。106万/130万のどちらが適用されるかは勤務先の規模・労働時間等で決まります。配偶者控除・配偶者特別控除（世帯側の税）や、社会保険加入で将来の年金・保障が増える点は含めていません。本サイトの計算結果は概算・参考値です。
      </p>
    </div>
  );
}
