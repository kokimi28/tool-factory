"use client";

import { useMemo, useReducer } from "react";
import { calculateNetSalary, type NetSalaryInput } from "@/lib/tedori/calculations";
import ResultDisplay from "@/components/tedori/ResultDisplay";
import CTA from "@/components/tedori/CTA";

type State = {
  annualIncome: string;
  isOver40: boolean;
};

type Action =
  | { type: "set"; field: keyof State; value: string | boolean }
  | { type: "reset" };

const initialState: State = {
  annualIncome: "4000000",
  isOver40: false,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "set":
      return { ...state, [action.field]: action.value };
    case "reset":
      return initialState;
    default:
      return state;
  }
}

/** 全角数字→半角、数字以外を除去して非負整数に */
function toInt(raw: string): number {
  const half = raw.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
  const digits = half.replace(/[^0-9]/g, "");
  const n = parseInt(digits, 10);
  return Number.isFinite(n) ? n : 0;
}

export default function Calculator() {
  const [state, dispatch] = useReducer(reducer, initialState);

  const input: NetSalaryInput = useMemo(
    () => ({
      annualIncome: toInt(state.annualIncome),
      isOver40: state.isOver40,
    }),
    [state],
  );

  const result = useMemo(() => calculateNetSalary(input), [input]);

  return (
    <div className="grid gap-8 md:grid-cols-2">
      <form
        className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        aria-label="年収の手取り計算フォーム"
        onSubmit={(e) => e.preventDefault()}
      >
        <h2 className="mb-4 text-lg font-bold text-slate-800">条件を入力</h2>

        <div className="space-y-5">
          <div>
            <label htmlFor="annualIncome" className="mb-1 block text-sm font-medium text-slate-700">
              年収（額面・賞与込み・円）
            </label>
            <input
              id="annualIncome"
              inputMode="numeric"
              autoComplete="off"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-right text-lg tabular-nums focus:border-brand focus:ring-2 focus:ring-brand/30"
              value={state.annualIncome}
              onChange={(e) => dispatch({ type: "set", field: "annualIncome", value: e.target.value })}
            />
            <p className="mt-1 text-right text-xs text-slate-500">
              {toInt(state.annualIncome).toLocaleString("ja-JP")} 円
            </p>
          </div>

          <fieldset>
            <legend className="mb-2 text-sm font-medium text-slate-700">年齢</legend>
            <label className="flex items-start gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand/30"
                checked={state.isOver40}
                onChange={(e) => dispatch({ type: "set", field: "isOver40", value: e.target.checked })}
              />
              <span>40歳以上65歳未満（介護保険料がかかる）</span>
            </label>
          </fieldset>

          <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
            会社員（協会けんぽ・一般の事業）で扶養なしの場合の概算です。健康保険料率は都道府県で、各種控除は扶養状況で変わります。
          </div>

          <button
            type="button"
            className="text-sm text-slate-500 underline underline-offset-2 hover:text-slate-700"
            onClick={() => dispatch({ type: "reset" })}
          >
            入力をリセット
          </button>
        </div>
      </form>

      <div className="space-y-6">
        <ResultDisplay result={result} />
        <CTA />
      </div>
    </div>
  );
}
