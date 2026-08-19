"use client";

import { useMemo, useState } from "react";
import { kakyuPension, furikaeKasan, KAKYU_AMOUNT } from "@/lib/nenkin-kuriage/kakyu";

const yen = (n: number) => `${Math.round(n).toLocaleString("ja-JP")}円`;

/**
 * 加給年金と振替加算（H7）。
 *
 * 配偶者や子がいると老齢厚生年金に上乗せされ、配偶者が65歳になると
 * 加給年金が終わって配偶者側の振替加算に切り替わる（生年月日で額が変わる）。
 * lib/nenkin-kuriage/kakyu.ts はその表まで実装済みだが画面に出ていなかった。
 */
export default function FamilyAddition() {
  const [hasSpouse, setHasSpouse] = useState(true);
  const [children, setChildren] = useState("0");
  const [birthDate, setBirthDate] = useState("1960-05-01");
  const [spouseBirthDate, setSpouseBirthDate] = useState("1962-05-01");

  const result = useMemo(
    () =>
      kakyuPension({
        hasEligibleSpouse: hasSpouse,
        eligibleChildCount: Number(children.replace(/[^0-9]/g, "")) || 0,
        recipientBirthDate: birthDate,
      }),
    [hasSpouse, children, birthDate],
  );
  const furikae = useMemo(() => furikaeKasan(spouseBirthDate), [spouseBirthDate]);

  return (
    <section
      className="rounded-2xl border border-gray-200 bg-white p-5"
      aria-labelledby="kakyu-heading"
    >
      <h2 id="kakyu-heading" className="text-sm font-bold text-gray-800">
        配偶者・子がいる場合の上乗せ（加給年金・振替加算）
      </h2>
      <p className="mt-2 text-xs text-gray-600 leading-relaxed">
        生計を維持している65歳未満の配偶者や、年齢制限を満たす子がいると老齢厚生年金に上乗せされます。特別加算は<strong>受給権者本人の生年月日</strong>で、振替加算は<strong>配偶者の生年月日</strong>で額が決まります。
      </p>

      <div className="mt-4 space-y-3">
        <label className="flex items-start gap-2 text-xs text-gray-700">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 rounded border-gray-300"
            checked={hasSpouse}
            onChange={(e) => setHasSpouse(e.target.checked)}
          />
          <span>生計を維持している65歳未満の配偶者がいる</span>
        </label>
        <label className="block text-xs text-gray-600">
          年齢制限を満たす子の人数
          <input
            inputMode="numeric"
            aria-label="子の人数"
            className="mt-1 block w-20 rounded border border-gray-300 px-2 py-1 text-right tabular-nums"
            value={children}
            onChange={(e) => setChildren(e.target.value)}
          />
        </label>
        <label className="block text-xs text-gray-600">
          本人の生年月日
          <input
            type="date"
            aria-label="本人の生年月日"
            className="mt-1 block rounded border border-gray-300 px-2 py-1"
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
          />
        </label>
        <label className="block text-xs text-gray-600">
          配偶者の生年月日（振替加算の判定）
          <input
            type="date"
            aria-label="配偶者の生年月日"
            className="mt-1 block rounded border border-gray-300 px-2 py-1"
            value={spouseBirthDate}
            onChange={(e) => setSpouseBirthDate(e.target.value)}
          />
        </label>
      </div>

      <div className="mt-4 rounded-lg bg-gray-50 p-3 text-sm text-gray-800" role="status">
        <p>
          加給年金は年 <span className="font-bold tabular-nums">{yen(result.total)}</span>
        </p>
        <ul className="mt-1 space-y-0.5 text-xs text-gray-600">
          <li>
            配偶者分 {yen(result.spouseTotal)}
            {result.spouseSpecialAddition > 0 && (
              <>（うち特別加算 {yen(result.spouseSpecialAddition)}）</>
            )}
          </li>
          <li>子の分 {yen(result.childrenTotal)}</li>
        </ul>
        <p className="mt-2 text-xs">
          配偶者が65歳になると加給年金は終わり、
          {furikae > 0 ? (
            <>
              配偶者の老齢基礎年金に振替加算 年{" "}
              <span className="font-bold tabular-nums">{yen(furikae)}</span> が付きます。
            </>
          ) : (
            <>この配偶者は振替加算の対象外です（昭和41年4月2日以後生まれ）。</>
          )}
        </p>
      </div>

      <p className="mt-3 text-xs text-gray-500">
        子は2人目まで1人あたり年{yen(KAKYU_AMOUNT.childFirstSecond)}、3人目以降は年
        {yen(KAKYU_AMOUNT.childThirdOnward)}です。繰下げ待機中は老齢厚生年金が支給されないため加給年金も出ません。
      </p>
    </section>
  );
}
