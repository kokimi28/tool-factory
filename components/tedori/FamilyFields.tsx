"use client";

import { dependentKindByAge } from "@/lib/tedori/dependents";
import type { FamilyInput } from "@/lib/tedori/family";

const KIND_LABEL: Record<ReturnType<typeof dependentKindByAge>, string> = {
  underSixteen: "16歳未満（控除の対象外）",
  general: "一般の扶養親族",
  specific: "特定扶養親族（19〜22歳）",
  elderly: "老人扶養親族（70歳以上）",
};

/**
 * 扶養している家族の入力欄（H1）。
 * 年齢で区分が決まるので、入力の横に判定結果をそのまま出して取り違えを防ぐ。
 */
export default function FamilyFields({
  family,
  onChange,
}: {
  family: FamilyInput[];
  onChange: (next: FamilyInput[]) => void;
}) {
  const update = (index: number, patch: Partial<FamilyInput>) =>
    onChange(family.map((f, i) => (i === index ? { ...f, ...patch } : f)));

  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium text-slate-700">扶養している家族</legend>
      {family.length === 0 ? (
        <p className="text-xs text-slate-500">なし（追加すると扶養控除が手取りに反映されます）</p>
      ) : (
        <ul className="space-y-3">
          {family.map((f, i) => (
            <li key={i} className="rounded-lg border border-slate-200 p-3">
              <div className="flex flex-wrap items-end gap-3">
                <label className="text-xs text-slate-600">
                  年齢
                  <input
                    inputMode="numeric"
                    aria-label={`扶養家族${i + 1}の年齢`}
                    className="mt-1 block w-20 rounded border border-slate-300 px-2 py-1 text-right tabular-nums"
                    value={String(f.age)}
                    onChange={(e) => update(i, { age: Number(e.target.value.replace(/[^0-9]/g, "")) || 0 })}
                  />
                </label>
                <label className="text-xs text-slate-600">
                  その人の年収（円）
                  <input
                    inputMode="numeric"
                    aria-label={`扶養家族${i + 1}の年収`}
                    className="mt-1 block w-32 rounded border border-slate-300 px-2 py-1 text-right tabular-nums"
                    value={String(f.annualIncome)}
                    onChange={(e) =>
                      update(i, { annualIncome: Number(e.target.value.replace(/[^0-9]/g, "")) || 0 })
                    }
                  />
                </label>
                <button
                  type="button"
                  className="ml-auto text-xs text-slate-500 underline underline-offset-2 hover:text-rose-600"
                  onClick={() => onChange(family.filter((_, j) => j !== i))}
                >
                  削除
                </button>
              </div>
              <p className="mt-2 text-xs text-slate-500">{KIND_LABEL[dependentKindByAge(f.age)]}</p>
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        className="mt-3 rounded-full border border-slate-300 px-3 py-1 text-xs text-slate-600 transition hover:border-brand hover:text-brand-dark"
        onClick={() => onChange([...family, { age: 20, annualIncome: 0 }])}
      >
        ＋ 扶養家族を追加
      </button>
    </fieldset>
  );
}
