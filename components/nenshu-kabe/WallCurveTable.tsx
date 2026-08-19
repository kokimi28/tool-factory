import { takeHomeWithWall, type SiWall } from "@/lib/nenshu-kabe/calculations";

const yen = (n: number) => `${Math.round(n).toLocaleString("ja-JP")}円`;
const man = (n: number) => `${(n / 10_000).toLocaleString("ja-JP")}万円`;

/**
 * 壁をまたぐ手取り曲線の年収グリッド（E6）。壁の直前→壁→壁の上を並べる。
 * 壁の直前（wall−1万）は扶養内で社保なし、壁ちょうどから社保加入＝手取りが逆転する点。
 */
export function wallCurveIncomes(wall: SiWall): number[] {
  return [wall - 200_000, wall - 10_000, wall, wall + 200_000, wall + 400_000];
}

/**
 * 年収の壁をまたぐ手取りの変化をデータ表で示す（E6・2巡目）。
 * 壁を境に社会保険へ加入し手取りが逆転する点を「社保加入」で明示する。
 */
export default function WallCurveTable({ wall }: { wall: SiWall }) {
  const rows = wallCurveIncomes(wall).map((income) => takeHomeWithWall(income, wall));

  return (
    <section
      className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
      aria-label="壁をまたぐ手取りの変化"
    >
      <h2 className="mb-3 text-sm font-bold text-gray-800">
        {man(wall)}の壁をまたぐ手取りの変化
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm tabular-nums">
          <thead>
            <tr className="text-gray-500">
              <th scope="col" className="py-1 text-left font-medium">年収</th>
              <th scope="col" className="py-1 text-right font-medium">手取り</th>
              <th scope="col" className="py-1 text-right font-medium">社保</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.income} className="border-t border-gray-100">
                <td className="py-1.5 text-left text-gray-700">{man(r.income)}</td>
                <td className="py-1.5 text-right font-semibold text-gray-900">{yen(r.takeHome)}</td>
                <td className="py-1.5 text-right">
                  {r.enrolled ? (
                    <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">加入</span>
                  ) : (
                    <span className="text-xs text-gray-500">扶養内</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-gray-500">
        壁の直前（扶養内・社保なし）から壁で社会保険に加入すると、手取りが一時的に下がります（働き損の谷）。本人の手取りの概算です。
      </p>
    </section>
  );
}
