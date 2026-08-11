"use client";

import { useMemo, useState } from "react";
import { grossFromNet } from "@/lib/tedori/reverse";
import { yen } from "@/lib/tedori/format";

/** 全角→半角、数字以外除去して非負整数に */
function toInt(raw: string): number {
  const half = raw.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
  const n = parseInt(half.replace(/[^0-9]/g, ""), 10);
  return Number.isFinite(n) ? n : 0;
}

/**
 * 手取りから必要年収を逆算するミニツール（D10）。
 * 目標の手取り月額から、その手取りに届く最小の額面年収を calc と同じロジックで求める。
 */
export default function ReverseLookup({ isOver40 }: { isOver40: boolean }) {
  const [monthly, setMonthly] = useState("250000");

  const { requiredGross, grossMonthly } = useMemo(() => {
    const annualTarget = toInt(monthly) * 12;
    const gross = grossFromNet(annualTarget, isOver40);
    return { requiredGross: gross, grossMonthly: Math.round(gross / 12) };
  }, [monthly, isOver40]);

  return (
    <section
      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
      aria-label="手取りから必要年収を逆算"
    >
      <h3 className="mb-1 text-sm font-bold text-slate-800">手取りから必要年収を逆算</h3>
      <p className="mb-3 text-xs text-slate-500">
        欲しい手取り月額から、その手取りに届く額面年収の目安を求めます（累進課税で固定倍率にならないため二分探索で厳密化）。
      </p>
      <label className="block">
        <span className="text-sm text-slate-700">目標の手取り月額</span>
        <div className="mt-1 flex items-center gap-2">
          <input
            inputMode="numeric"
            value={monthly}
            onChange={(e) => setMonthly(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-right tabular-nums focus:border-brand focus:ring-2 focus:ring-brand/30"
          />
          <span className="text-slate-500">円</span>
        </div>
      </label>
      <div className="mt-4 rounded-xl bg-brand/5 p-4 text-center">
        <p className="text-sm text-brand-dark">必要な額面年収の目安</p>
        <p className="mt-1 text-2xl font-bold tabular-nums text-brand-dark">{yen(requiredGross)}</p>
        <p className="mt-1 text-sm text-slate-600">額面月額 {yen(grossMonthly)}</p>
      </div>
      <p className="mt-2 text-xs text-slate-400">
        {isOver40 ? "40歳以上（介護保険料あり）" : "40歳未満"}・扶養なしの概算です。
      </p>
    </section>
  );
}
