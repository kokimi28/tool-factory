"use client";

import { useMemo, useState } from "react";
import {
  compareReceiptMethods,
  type ReceiptComparisonInput,
} from "@/lib/ideco/receipt-comparison";

const yen = (n: number) => `${Math.round(n).toLocaleString("ja-JP")}円`;
const toInt = (s: string) => Number(s.replace(/[^0-9]/g, "")) || 0;

/**
 * 一時金と年金、どちらで受け取るか（H4）。
 *
 * 一時金は退職所得控除、年金は公的年金等控除と、使う控除がまったく別。
 * さらに年金は公的年金と同じ枠を食い合うため、公的年金の額と受給開始年齢で答えが変わる。
 * lib/ideco/receipt-comparison.ts（G3）はそこまで含めて年ごとに計算するが、
 * これまで記事の中でしか読めなかった。
 */
export default function ReceiptCompare() {
  const [amount, setAmount] = useState("8000000");
  const [years, setYears] = useState("15");
  const [annuityYears, setAnnuityYears] = useState("5");
  const [publicPension, setPublicPension] = useState("1800000");
  const [startAge, setStartAge] = useState("65");

  const input: ReceiptComparisonInput = useMemo(
    () => ({
      idecoAmount: toInt(amount),
      contributionYears: toInt(years),
      annuityYears: Math.max(1, toInt(annuityYears)),
      publicPensionPerYear: toInt(publicPension),
      receiptStartAge: Math.max(1, toInt(startAge)),
    }),
    [amount, years, annuityYears, publicPension, startAge],
  );

  const c = useMemo(() => compareReceiptMethods(input), [input]);
  const winnerLabel =
    c.winner === "lumpSum" ? "一時金" : c.winner === "annuity" ? "年金" : "同額";

  return (
    <section
      className="rounded-2xl border border-slate-200 bg-white p-6"
      aria-labelledby="ideco-receipt-heading"
    >
      <h3 id="ideco-receipt-heading" className="text-lg font-bold text-slate-800">
        一時金と年金、どちらで受け取るか
      </h3>
      <p className="mt-2 text-sm text-slate-600">
        一時金は<strong>退職所得控除</strong>、年金は<strong>公的年金等控除</strong>と、使う控除が別です。年金で受け取ると公的年金と同じ控除枠を食い合うため、公的年金の額によって答えが変わります。
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block text-xs text-slate-600">
          iDeCo の受取総額（円）
          <input
            inputMode="numeric"
            aria-label="iDeCoの受取総額"
            className="mt-1 block w-full rounded border border-slate-300 px-2 py-1 text-right tabular-nums"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </label>
        <label className="block text-xs text-slate-600">
          加入年数（年）
          <input
            inputMode="numeric"
            aria-label="加入年数"
            className="mt-1 block w-full rounded border border-slate-300 px-2 py-1 text-right tabular-nums"
            value={years}
            onChange={(e) => setYears(e.target.value)}
          />
        </label>
        <label className="block text-xs text-slate-600">
          年金で受け取る場合の分割年数（年）
          <input
            inputMode="numeric"
            aria-label="分割年数"
            className="mt-1 block w-full rounded border border-slate-300 px-2 py-1 text-right tabular-nums"
            value={annuityYears}
            onChange={(e) => setAnnuityYears(e.target.value)}
          />
        </label>
        <label className="block text-xs text-slate-600">
          併給する公的年金（年額・円）
          <input
            inputMode="numeric"
            aria-label="併給する公的年金の年額"
            className="mt-1 block w-full rounded border border-slate-300 px-2 py-1 text-right tabular-nums"
            value={publicPension}
            onChange={(e) => setPublicPension(e.target.value)}
          />
        </label>
        <label className="block text-xs text-slate-600">
          年金で受け取り始める年齢（歳）
          <input
            inputMode="numeric"
            aria-label="受け取り始める年齢"
            className="mt-1 block w-full rounded border border-slate-300 px-2 py-1 text-right tabular-nums"
            value={startAge}
            onChange={(e) => setStartAge(e.target.value)}
          />
        </label>
      </div>

      <div className="mt-5 rounded-xl border border-brand/30 bg-brand/5 p-4 text-center" role="status">
        <p className="text-sm text-slate-600">手取りが多いのは</p>
        <p className="mt-1 text-2xl font-bold text-slate-900">{winnerLabel}</p>
        {c.winner !== "tie" && (
          <p className="mt-1 text-sm text-slate-700 tabular-nums">
            差は {yen(c.differenceInNet)}
          </p>
        )}
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-500">
              <th scope="col" className="py-2 pr-2 font-medium">受け取り方</th>
              <th scope="col" className="py-2 px-2 font-medium text-right">税の合計</th>
              <th scope="col" className="py-2 pl-2 font-medium text-right">手取り</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-slate-100">
              <td className="py-1.5 pr-2 text-slate-700">
                一時金
                <span className="ml-1 text-xs text-slate-400">
                  退職所得控除 {yen(c.lumpSum.deduction)}
                </span>
              </td>
              <td className="py-1.5 px-2 text-right tabular-nums text-slate-800">
                {yen(c.lumpSum.totalTax)}
              </td>
              <td className="py-1.5 pl-2 text-right font-semibold tabular-nums text-slate-900">
                {yen(c.lumpSum.net)}
              </td>
            </tr>
            <tr className="border-b border-slate-100">
              <td className="py-1.5 pr-2 text-slate-700">
                年金（{c.annuity.years}年・年{yen(c.annuity.perYear)}）
              </td>
              <td className="py-1.5 px-2 text-right tabular-nums text-slate-800">
                {yen(c.annuity.totalTax)}
              </td>
              <td className="py-1.5 pl-2 text-right font-semibold tabular-nums text-slate-900">
                {yen(c.annuity.net)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <details className="mt-3">
        <summary className="cursor-pointer text-xs text-slate-500">年金で受け取る場合の年ごとの内訳</summary>
        <table className="mt-2 w-full text-xs">
          <thead>
            <tr className="text-left text-slate-500">
              <th scope="col" className="py-1 font-medium">年齢</th>
              <th scope="col" className="py-1 text-right font-medium">公的年金</th>
              <th scope="col" className="py-1 text-right font-medium">iDeCo で増える税</th>
            </tr>
          </thead>
          <tbody>
            {c.annuity.schedule.map((y) => (
              <tr key={y.age} className="border-t border-slate-100">
                <td className="py-1 text-slate-600">{y.age}歳</td>
                <td className="py-1 text-right tabular-nums text-slate-600">{yen(y.publicPension)}</td>
                <td className="py-1 text-right tabular-nums text-slate-700">{yen(y.extraTax)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>

      <p className="mt-3 text-xs text-slate-500 leading-relaxed">
        勤務先の退職金を先に一時金で受け取っている場合は退職所得控除の枠がその分減りますが、この表では考慮していません。社会保険料への影響も含めていません。
      </p>
    </section>
  );
}
