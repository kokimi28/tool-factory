import { wallScenarios, householdBurdenStartsAt } from "@/lib/nenshu-kabe/scenarios";
import type { SiWall } from "@/lib/nenshu-kabe/calculations";

const yen = (n: number) => `${Math.round(n).toLocaleString("ja-JP")}円`;
const man = (n: number) => `${Math.round(n / 10000).toLocaleString("ja-JP")}万円`;
const signedYen = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : "±"}${yen(Math.abs(n))}`;

/**
 * 壁をまたぐ3つの選択肢を横並びで比較する（E5）。
 * 本人の手取りに加えて、扶養している側の税がいくら増えるかを併記する
 * （3案とも0円になる＝社会保険の壁では世帯側の控除は減らない）。
 */
export default function ScenarioCompare({
  wall,
  isOver40 = false,
}: {
  wall: SiWall;
  isOver40?: boolean;
}) {
  const rows = wallScenarios(wall, isOver40);
  const burdenStart = householdBurdenStartsAt();
  const allZero = rows.every((r) => r.filerTaxIncrease === 0);

  return (
    <section aria-label="3つの働き方の比較">
      <h2 className="mb-3 text-sm font-bold text-gray-800">
        {man(wall)}の壁：3つの選び方を並べる
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-gray-500">
              <th scope="col" className="py-2 pr-2 font-medium">選び方</th>
              <th scope="col" className="py-2 px-2 font-medium">年収</th>
              <th scope="col" className="py-2 px-2 font-medium text-right">本人の手取り</th>
              <th scope="col" className="py-2 px-2 font-medium text-right">壁の下との差</th>
              <th scope="col" className="py-2 pl-2 font-medium text-right">扶養側の追加負担</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.kind} className="border-b border-gray-100">
                <td className="py-1.5 pr-2 text-gray-700">
                  {r.label}
                  <span className="ml-1 text-xs text-gray-500">
                    {r.enrolled ? "（社保 加入）" : "（扶養内）"}
                  </span>
                </td>
                <td className="py-1.5 px-2 tabular-nums text-gray-700">{yen(r.income)}</td>
                <td className="py-1.5 px-2 text-right font-semibold tabular-nums text-gray-900">
                  {yen(r.takeHome)}
                </td>
                <td
                  className={`py-1.5 px-2 text-right tabular-nums ${
                    r.takeHomeDiff < 0 ? "text-rose-700" : "text-gray-500"
                  }`}
                >
                  {signedYen(r.takeHomeDiff)}
                </td>
                <td className="py-1.5 pl-2 text-right tabular-nums text-gray-700">
                  {yen(r.filerTaxIncrease)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {allZero && (
        <p className="mt-2 text-xs text-gray-500 leading-relaxed">
          3案とも扶養している側の追加負担は0円です。年収1,230,000円で配偶者控除を外れても配偶者特別控除が満額38万円で引き継ぐため、社会保険の壁を超えても世帯側の控除は減りません。控除が減り始めるのは本人の年収が{yen(burdenStart - 1)}を超えてからです。
        </p>
      )}
    </section>
  );
}
