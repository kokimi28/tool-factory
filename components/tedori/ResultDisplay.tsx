import type { NetSalaryResult } from "@/lib/tedori/calculations";
import { yen } from "@/lib/tedori/format";

function Row({
  label,
  value,
  sub,
  strong = false,
}: {
  label: string;
  value: string;
  sub?: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2">
      <span className={strong ? "text-sm font-semibold text-slate-700" : "text-sm text-slate-600"}>
        {label}
        {sub ? <span className="ml-1 text-xs text-slate-400">{sub}</span> : null}
      </span>
      <span
        className={
          strong ? "text-lg font-bold tabular-nums text-slate-900" : "tabular-nums text-slate-800"
        }
      >
        {value}
      </span>
    </div>
  );
}

export default function ResultDisplay({ result }: { result: NetSalaryResult }) {
  const {
    healthInsurance,
    nursingInsurance,
    pensionInsurance,
    employmentInsurance,
    socialInsurance,
    salaryDeduction,
    employmentIncome,
    taxableIncomeForIncomeTax,
    incomeTax,
    residentTax,
    totalDeduction,
    takeHome,
    takeHomeMonthly,
    takeHomeRate,
  } = result;

  const ratePct = (takeHomeRate * 100).toFixed(1);

  return (
    <section
      className="rounded-2xl border border-brand/20 bg-brand/5 p-6"
      aria-label="計算結果"
      aria-live="polite"
    >
      <h2 className="mb-1 text-lg font-bold text-slate-800">計算結果</h2>
      <p className="mb-4 text-xs text-slate-500">※あくまで概算・参考値です。実際の金額は勤務先・自治体・扶養状況により異なります。</p>

      <div className="mb-4 rounded-xl bg-white p-4 shadow-sm">
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-semibold text-slate-700">手取り額（年額）</span>
          <span className="text-2xl font-bold tabular-nums text-brand-dark">{yen(takeHome)}</span>
        </div>
        <div className="mt-2 flex items-baseline justify-between border-t border-slate-100 pt-2">
          <span className="text-sm text-slate-600">手取り月額の目安</span>
          <span className="text-xl font-bold tabular-nums text-slate-900">{yen(takeHomeMonthly)}</span>
        </div>
        <div className="mt-2 flex items-baseline justify-between">
          <span className="text-sm text-slate-600">手取り率</span>
          <span className="tabular-nums text-slate-800">{ratePct}%</span>
        </div>
      </div>

      <div className="divide-y divide-slate-200">
        <Row label="健康保険料" value={yen(healthInsurance)} />
        {nursingInsurance > 0 && <Row label="介護保険料" sub="40歳以上" value={yen(nursingInsurance)} />}
        <Row label="厚生年金保険料" value={yen(pensionInsurance)} />
        <Row label="雇用保険料" value={yen(employmentInsurance)} />
        <Row label="社会保険料 合計" value={yen(socialInsurance)} strong />
        <Row label="所得税" sub="復興特別所得税込み" value={yen(incomeTax)} />
        <Row label="住民税" sub="概算" value={yen(residentTax)} />
        <Row label="差引かれる合計" value={yen(totalDeduction)} strong />
      </div>

      <details className="mt-4 rounded-xl bg-white p-4 shadow-sm">
        <summary className="cursor-pointer text-sm font-semibold text-slate-700">
          計算の内訳（詳しく）
        </summary>
        <div className="mt-2 divide-y divide-slate-200">
          <Row label="給与所得控除" value={yen(salaryDeduction)} />
          <Row label="給与所得" sub="額面 − 給与所得控除" value={yen(employmentIncome)} />
          <Row label="社会保険料控除" value={yen(socialInsurance)} />
          <Row label="課税所得（所得税の計算基礎）" value={yen(taxableIncomeForIncomeTax)} />
          <Row label="所得税" sub="復興特別所得税込み" value={yen(incomeTax)} />
          <Row label="住民税" sub="概算" value={yen(residentTax)} />
        </div>
        <p className="mt-2 text-xs text-slate-400">
          給与所得から社会保険料控除・基礎控除などを差し引いた課税所得に所得税がかかります。住民税は別途、前年所得ベースの概算です。
        </p>
      </details>

      <p className="mt-4 text-xs text-slate-500">
        社会保険料は標準報酬月額の等級表を用いない年収ベースの概算です。住民税は前年所得に対して課税されるため、当年の年収から求めた目安になります。
      </p>
    </section>
  );
}
