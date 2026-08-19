import { calculateNetSalary } from "@/lib/tedori/calculations";
import { yen } from "@/lib/tedori/format";

/** 比較する代表年収（E5・3シナリオ横並び）。 */
export const SCENARIO_INCOMES = [4_000_000, 6_000_000, 8_000_000] as const;

/**
 * 代表的な3年収の手取りを横並びで比較する（E5・2巡目）。
 * 現在の「40歳以上か」の条件を反映して calculateNetSalary の結果をそのまま表示する。
 */
export default function ScenarioCompare({ isOver40 }: { isOver40: boolean }) {
  const rows = SCENARIO_INCOMES.map((income) => {
    const r = calculateNetSalary({ annualIncome: income, isOver40 });
    return { income, takeHome: r.takeHome, ratePct: (r.takeHomeRate * 100).toFixed(1) };
  });

  return (
    <section
      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
      aria-label="年収別の手取り比較"
    >
      <h3 className="mb-3 text-sm font-bold text-slate-800">年収別の手取り比較</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm tabular-nums">
          <thead>
            <tr className="text-slate-500">
              <th scope="col" className="py-1 text-left font-medium">年収</th>
              <th scope="col" className="py-1 text-right font-medium">手取り（年額）</th>
              <th scope="col" className="py-1 text-right font-medium">手取り率</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.income} className="border-t border-slate-100">
                <td className="py-1.5 text-left text-slate-700">
                  {(r.income / 10_000).toLocaleString("ja-JP")}万円
                </td>
                <td className="py-1.5 text-right font-semibold text-slate-900">{yen(r.takeHome)}</td>
                <td className="py-1.5 text-right text-slate-700">{r.ratePct}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-slate-500">
        {isOver40 ? "40歳以上（介護保険料あり）" : "40歳未満"}・扶養なしの概算です。年収を上げると手取り率は下がります。
      </p>
    </section>
  );
}
