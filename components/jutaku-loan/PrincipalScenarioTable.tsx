import {
  calcHomeLoanDeduction,
  type HousingType,
} from "@/lib/jutaku-loan/calculations";

const yen = (n: number) => `${Math.round(n).toLocaleString("ja-JP")}円`;
const man = (n: number) => `${(n / 10_000).toLocaleString("ja-JP")}万円`;

/** 比較する借入額の代表点（E8・控除/返済の同時表示）。 */
export const LOAN_PRINCIPAL_POINTS = [
  25_000_000, 30_000_000, 35_000_000, 40_000_000, 45_000_000,
] as const;

export type LoanScenarioParams = {
  annualRatePercent: number;
  years: number;
  housingType: HousingType;
  childRearingHousehold: boolean;
};

/**
 * 借入額を変えたときの「毎月返済額」と「控除見込み総額」を横並びで示す（E8・2巡目）。
 * 金利・期間・住宅種別・世帯条件は現在の入力を固定し、借入額だけを振って
 * 「借りるほど返済は増えるが控除は限度額で頭打ち」というトレードオフを一望させる。
 */
export default function PrincipalScenarioTable({
  annualRatePercent,
  years,
  housingType,
  childRearingHousehold,
}: LoanScenarioParams) {
  const rows = LOAN_PRINCIPAL_POINTS.map((principal) => {
    const r = calcHomeLoanDeduction({
      principal,
      annualRatePercent,
      years,
      housingType,
      childRearingHousehold,
    });
    return {
      principal,
      monthlyPayment: r.monthlyPayment,
      totalDeduction: r.totalDeduction,
    };
  });

  return (
    <section
      className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
      aria-label="借入額別の返済と控除の比較"
    >
      <h2 className="mb-3 text-sm font-bold text-gray-800">
        借入額別の返済額と控除総額（金利・期間・住宅種別は現在の条件）
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm tabular-nums">
          <thead>
            <tr className="text-gray-500">
              <th scope="col" className="py-1 text-left font-medium">借入額</th>
              <th scope="col" className="py-1 text-right font-medium">毎月返済</th>
              <th scope="col" className="py-1 text-right font-medium">控除総額</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.principal} className="border-t border-gray-100">
                <td className="py-1.5 text-left text-gray-700">{man(r.principal)}</td>
                <td className="py-1.5 text-right font-semibold text-gray-900">{yen(r.monthlyPayment)}</td>
                <td className="py-1.5 text-right text-emerald-700">{yen(r.totalDeduction)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-gray-500">
        借入額を増やすほど毎月の返済は増えますが、控除総額は借入限度額で頭打ちになります。概算・参考値です。
      </p>
    </section>
  );
}
