"use client";

import { useMemo, useState } from "react";
import { judgeWall, WALL_SCHEDULE, type WallConditions } from "@/lib/nenshu-kabe/eligibility";
import type { SiWall } from "@/lib/nenshu-kabe/calculations";

const man = (n: number) => `${Math.round(n / 10000).toLocaleString("ja-JP")}万円`;

const INITIAL: WallConditions = {
  employeeCount: 51,
  weeklyHours: 20,
  monthlyWage: 90_000,
  employmentOverTwoMonths: true,
  isStudent: false,
};

/**
 * どちらの壁が効くかを条件から判定する（H1 系の未接続解消・auto-backlog H3）。
 *
 * 106万円の壁は年収だけでは決まらず、勤務先と働き方の条件を**すべて**満たしたときだけ
 * 適用される。1つでも欠けると106万円を超えても加入せず、判定は130万円で行われる。
 * これまでは利用者が自分でどちらかを選ぶ作りだったため、
 * 「106万円を超えたら必ず手取りが下がる」という誤解を招きやすかった。
 */
export default function WallJudge({
  asOf,
  onJudge,
}: {
  /** 判定する日（YYYY-MM-DD）。制度変更が2段階で入るため呼び出し側が渡す */
  asOf: string;
  /** 判定結果の壁を計算側へ反映する */
  onJudge: (wall: SiWall) => void;
}) {
  const [c, setC] = useState<WallConditions>(INITIAL);
  const result = useMemo(() => judgeWall(c, asOf), [c, asOf]);
  const set = <K extends keyof WallConditions>(key: K, value: WallConditions[K]) =>
    setC((prev) => ({ ...prev, [key]: value }));

  return (
    <section
      className="rounded-2xl border border-gray-200 bg-white p-5"
      aria-labelledby="wall-judge-heading"
    >
      <h2 id="wall-judge-heading" className="text-sm font-bold text-gray-800">
        どちらの壁が効くか判定する
      </h2>
      <p className="mt-2 text-xs text-gray-600 leading-relaxed">
        106万円の壁は年収だけでは決まりません。下の条件を<strong>すべて</strong>満たしたときだけ社会保険に加入し、1つでも欠けると106万円を超えても加入せず、扶養の判定は130万円で行われます。
      </p>

      <div className="mt-4 space-y-3">
        <label className="block text-xs text-gray-600">
          勤務先の厚生年金被保険者数（法人全体）
          <input
            inputMode="numeric"
            aria-label="勤務先の厚生年金被保険者数"
            className="mt-1 block w-28 rounded border border-gray-300 px-2 py-1 text-right tabular-nums"
            value={String(c.employeeCount)}
            onChange={(e) => set("employeeCount", Number(e.target.value.replace(/[^0-9]/g, "")) || 0)}
          />
        </label>
        <label className="block text-xs text-gray-600">
          週の所定労働時間（残業を含めない・時間）
          <input
            inputMode="numeric"
            aria-label="週の所定労働時間"
            className="mt-1 block w-28 rounded border border-gray-300 px-2 py-1 text-right tabular-nums"
            value={String(c.weeklyHours)}
            onChange={(e) => set("weeklyHours", Number(e.target.value.replace(/[^0-9]/g, "")) || 0)}
          />
        </label>
        {result.wageRequirementApplies && (
          <label className="block text-xs text-gray-600">
            所定内賃金の月額（残業代・賞与・通勤手当を含めない・円）
            <input
              inputMode="numeric"
              aria-label="所定内賃金の月額"
              className="mt-1 block w-32 rounded border border-gray-300 px-2 py-1 text-right tabular-nums"
              value={String(c.monthlyWage)}
              onChange={(e) => set("monthlyWage", Number(e.target.value.replace(/[^0-9]/g, "")) || 0)}
            />
          </label>
        )}
        <label className="flex items-start gap-2 text-xs text-gray-700">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 rounded border-gray-300"
            checked={c.employmentOverTwoMonths}
            onChange={(e) => set("employmentOverTwoMonths", e.target.checked)}
          />
          <span>2か月を超えて雇用される見込みがある</span>
        </label>
        <label className="flex items-start gap-2 text-xs text-gray-700">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 rounded border-gray-300"
            checked={c.isStudent}
            onChange={(e) => set("isStudent", e.target.checked)}
          />
          <span>学生である（昼間部）</span>
        </label>
      </div>

      <div
        className={`mt-4 rounded-lg p-3 text-sm ${
          result.coveredBy106 ? "bg-rose-50 text-rose-900" : "bg-gray-50 text-gray-800"
        }`}
        role="status"
      >
        <p>
          効くのは <span className="font-bold">{man(result.wall)}の壁</span>
          {result.coveredBy106 ? "（適用拡大の対象）" : "（適用拡大の対象外＝扶養の判定）"}
        </p>
        {result.unmetConditions.length > 0 && (
          <ul className="mt-2 list-disc pl-5 text-xs">
            {result.unmetConditions.map((u) => (
              <li key={u}>{u}</li>
            ))}
          </ul>
        )}
        <button
          type="button"
          className="mt-3 rounded-full border border-current px-3 py-1 text-xs"
          onClick={() => onJudge(result.wall)}
        >
          この判定を計算に反映する
        </button>
      </div>

      <p className="mt-3 text-xs text-gray-500 leading-relaxed">
        判定日 {asOf} 時点の基準（企業規模 {result.firmSizeThreshold}人以上）で計算しています。
        企業規模の要件は {WALL_SCHEDULE.firmSizeLoweredOn} に
        {WALL_SCHEDULE.firmSizeThresholdNow}人以上 → {WALL_SCHEDULE.firmSizeThresholdAfter}人以上へ拡大し、
        所定内賃金 月額{WALL_SCHEDULE.monthlyWageThreshold.toLocaleString("ja-JP")}円以上の要件は{" "}
        {WALL_SCHEDULE.wageRequirementRemovedOn} に撤廃される予定です。
      </p>
    </section>
  );
}
