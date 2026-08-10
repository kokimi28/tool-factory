'use client';

/**
 * 退職金課税シミュレーター - メインCalculator
 *
 * 差別化要素：
 * - A: 「あと1年勤めると」比較カード（手取り額直下）
 * - B: DC一時金10年ルール警告ボックス
 * - E: 自己都合/会社都合の選択でCTA文言を出し分け
 */

import { useEffect, useRef, useState, useMemo } from 'react';
import {
  calcAll,
  compareWithOneMoreYear,
  validateInput,
  type RetirementInput,
  type SeparationReason,
  type RetirementCategory,
} from '@/lib/taishokukin/calculations';
import { TAISHOKUKIN_PRESETS } from '@/lib/taishokukin/presets';
import { encodeShareParams, decodeShareParams } from '@/lib/share-url';
import { parseSeparation, boolToFlag, flagToBool } from '@/lib/taishokukin/share';
import { resultToClipboardText } from '@/lib/taishokukin/result-text';
import CopyResult from '@/components/taishokukin/CopyResult';

/** 金額を「○○円」形式（カンマ区切り）でフォーマット */
function yen(n: number): string {
  return `${n.toLocaleString('ja-JP')}円`;
}

/** 万円を円に変換 */
function manToYen(man: number): number {
  return Math.round(man * 10_000);
}

/** 計算分岐の表示名 */
const CATEGORY_LABEL: Record<RetirementCategory, string> = {
  general: '一般退職手当等',
  specificExecutive: '特定役員退職手当等（1/2課税なし）',
  shortTermUnder300: '短期退職手当等（300万円以下）',
  shortTermOver300: '短期退職手当等（300万円超部分は1/2課税なし）',
};


export default function Calculator() {
  // 入力状態
  const [retirementMan, setRetirementMan] = useState<string>('2000');
  const [years, setYears] = useState<string>('25');
  const [months, setMonths] = useState<string>('0');
  const [isExecutive, setIsExecutive] = useState<boolean>(false);
  const [separation, setSeparation] = useState<SeparationReason>('voluntary');
  const hydrated = useRef(false);
  const [copied, setCopied] = useState(false);

  // マウント時に URL のクエリから入力を復元（共有リンクで同じ結果を再現）。
  useEffect(() => {
    const p = decodeShareParams(window.location.search);
    if (p.man) setRetirementMan(p.man);
    if (p.years) setYears(p.years);
    if (p.months) setMonths(p.months);
    if (p.exec) setIsExecutive(flagToBool(p.exec));
    if (p.sep) setSeparation(parseSeparation(p.sep));
    hydrated.current = true;
  }, []);

  // 入力が変わったら URL に反映（履歴を汚さない replaceState）。復元完了後のみ。
  useEffect(() => {
    if (!hydrated.current) return;
    const qs = encodeShareParams({
      man: retirementMan,
      years,
      months,
      exec: boolToFlag(isExecutive),
      sep: separation,
    });
    window.history.replaceState(null, '', qs || window.location.pathname);
  }, [retirementMan, years, months, isExecutive, separation]);

  async function copyShareLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // クリップボード不可の環境では何もしない（URL は既にアドレスバーに反映済み）。
    }
  }

  // 入力を数値化
  const input: Partial<RetirementInput> = {
    retirementAmount: retirementMan !== '' ? manToYen(Number(retirementMan)) : undefined,
    yearsOfService: years !== '' ? Number(years) : undefined,
    monthsOfService: months !== '' ? Number(months) : 0,
    isExecutive,
    separationReason: separation,
  };

  const errors = useMemo(() => validateInput(input), [
    retirementMan,
    years,
    months,
    isExecutive,
  ]);
  const isValid = errors.length === 0;

  const result = useMemo(() => {
    if (!isValid) return null;
    return calcAll(input as RetirementInput);
  }, [isValid, retirementMan, years, months, isExecutive]);

  const comparison = useMemo(() => {
    if (!isValid) return null;
    return compareWithOneMoreYear(input as RetirementInput);
  }, [isValid, retirementMan, years, months, isExecutive]);

  return (
    <div className="w-full max-w-3xl mx-auto space-y-6">
      {/* 入力フォーム */}
      <section className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
        <h2 className="text-lg font-bold text-gray-900 mb-4">条件を入力</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              退職金額（万円）
            </label>
            <input
              type="number"
              inputMode="numeric"
              min="0"
              step="1"
              value={retirementMan}
              onChange={(e) => setRetirementMan(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="例: 2000"
            />
            <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="退職金額プリセット">
              {TAISHOKUKIN_PRESETS.map((p) => (
                <button
                  key={p.man}
                  type="button"
                  className="rounded-full border border-gray-300 px-3 py-1 text-xs text-gray-600 transition hover:border-blue-400 hover:text-blue-700"
                  onClick={() => setRetirementMan(String(p.man))}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                勤続年数（年）
              </label>
              <input
                type="number"
                inputMode="numeric"
                min="0"
                max="70"
                step="1"
                value={years}
                onChange={(e) => setYears(e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                端数月（任意）
              </label>
              <input
                type="number"
                inputMode="numeric"
                min="0"
                max="11"
                step="1"
                value={months}
                onChange={(e) => setMonths(e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
          <p className="text-xs text-gray-500">※ 端数月が1ヶ月以上ある場合、勤続年数は切り上げ（例: 19年5ヶ月 → 20年）</p>

          <div>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={isExecutive}
                onChange={(e) => setIsExecutive(e.target.checked)}
                className="rounded border-gray-300"
              />
              役員等として在任した期間がある（取締役、執行役、会計参与、監査役、理事、監事、清算人など）
            </label>
            <p className="text-xs text-gray-500 ml-6 mt-1">
              役員等で勤続5年以下の場合、退職所得控除後の金額の1/2課税が適用されません。
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">退職理由</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="separation"
                  value="voluntary"
                  checked={separation === 'voluntary'}
                  onChange={() => setSeparation('voluntary')}
                />
                自己都合
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="separation"
                  value="involuntary"
                  checked={separation === 'involuntary'}
                  onChange={() => setSeparation('involuntary')}
                />
                会社都合
              </label>
            </div>
            <p className="text-xs text-gray-500 mt-1">※ 計算結果には影響しませんが、その後の手続きが異なります。</p>
          </div>
        </div>

        {errors.length > 0 && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
            {errors.map((e, i) => (
              <p key={i}>・{e.message}</p>
            ))}
          </div>
        )}
      </section>


      {/* 計算結果 */}
      {result && (
        <section className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm space-y-4">
          <h2 className="text-lg font-bold text-gray-900">計算結果</h2>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between py-1 border-b border-gray-100">
              <span className="text-gray-600">適用区分</span>
              <span className="font-medium text-gray-900">{CATEGORY_LABEL[result.category]}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-gray-100">
              <span className="text-gray-600">勤続年数（切り上げ後）</span>
              <span className="font-medium text-gray-900">{result.effectiveYears} 年</span>
            </div>
            <div className="flex justify-between py-1 border-b border-gray-100">
              <span className="text-gray-600">退職所得控除額</span>
              <span className="font-medium text-gray-900">{yen(result.retirementDeduction)}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-gray-100">
              <span className="text-gray-600">課税退職所得金額</span>
              <span className="font-medium text-gray-900">{yen(result.taxableRetirementIncome)}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-gray-100">
              <span className="text-gray-600">所得税（復興特別所得税込み）</span>
              <span className="font-medium text-gray-900">{yen(result.incomeTax)}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-gray-100">
              <span className="text-gray-600">住民税</span>
              <span className="font-medium text-gray-900">{yen(result.residentTax)}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-gray-100 font-semibold">
              <span className="text-gray-700">税額合計</span>
              <span className="text-gray-900">{yen(result.totalTax)}</span>
            </div>
          </div>

          {/* 手取り額（強調表示） */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
            <p className="text-sm text-blue-700 mb-1">手取り額</p>
            <p className="text-3xl font-bold text-blue-900">{yen(result.netAmount)}</p>
          </div>

          {/* 結果の共有（E3）＋テキストコピー（E12） */}
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <button
              type="button"
              onClick={copyShareLink}
              aria-live="polite"
              className="text-sm font-medium text-blue-700 underline underline-offset-2 hover:text-blue-800"
            >
              {copied ? 'リンクをコピーしました' : 'この結果のリンクをコピー'}
            </button>
            <CopyResult text={resultToClipboardText(result)} />
          </div>

          <p className="text-xs text-gray-500">
            ※ あくまで参考値です。実際の税額は退職時の所得状況や他の所得との通算により変動する場合があります。
          </p>
        </section>
      )}

      {/* 差別化要素A: 「あと1年勤めると」比較 */}
      {comparison && (
        <section className="bg-amber-50 border border-amber-200 rounded-lg p-6">
          <h3 className="font-bold text-amber-900 mb-3">📅 あと1年勤めると…</h3>
          <p className="text-sm text-amber-900 mb-3">
            勤続年数を <strong>{comparison.current.effectiveYears} 年</strong> から{' '}
            <strong>{comparison.plusOneYear.effectiveYears} 年</strong> に伸ばすと：
          </p>
          <div className="space-y-1 text-sm text-amber-900">
            <p>
              ・退職所得控除額が <strong>{yen(comparison.deductionDiff)}</strong> 増える
            </p>
            <p>
              ・税額合計が <strong>{yen(Math.max(comparison.totalTaxDiff, 0))}</strong> 減る（節税効果）
            </p>
            <p>
              ・手取り額が <strong>{yen(Math.max(comparison.netAmountDiff, 0))}</strong> 増える
            </p>
          </div>
          {comparison.current.effectiveYears === 20 && (
            <p className="mt-3 text-xs text-amber-800 bg-amber-100 rounded p-2">
              💡 勤続20年の壁：21年目以降は控除額が「年70万円ずつ」増えるため、20年目で辞めるよりも21年勤めた方が控除が一気に増えます。
            </p>
          )}
        </section>
      )}

      {/* 差別化要素B: DC一時金10年ルール警告 */}
      {result && (
        <section className="bg-orange-50 border border-orange-200 rounded-lg p-6">
          <h3 className="font-bold text-orange-900 mb-2">⚠️ iDeCo・企業型DC一時金を受け取った方へ</h3>
          <p className="text-sm text-orange-900 mb-2">
            <strong>2026年1月1日以降</strong> に退職金を受け取る方で、過去 <strong>10年以内</strong>{' '}
            に iDeCo・企業型DCの一時金を受け取っている場合、退職所得控除の調整規定が適用され、控除額が減額される可能性があります。
          </p>
          <p className="text-xs text-orange-800">
            （従来は5年ルールでしたが、令和7年度税制改正により10年ルールに延長されました）
          </p>
          <p className="text-sm text-orange-900 mt-3">
            このシミュレーターでは調整計算は行いません。該当する方は税理士への相談をおすすめします。
          </p>
        </section>
      )}


      {/* CTA①: FP相談（差別化要素E: 自己都合/会社都合で訴求変更） */}
      {result && (
        <section className="bg-white border border-gray-200 rounded-lg p-6">
          <p className="text-xs text-gray-500 mb-2">PR</p>
          <h3 className="font-bold text-gray-900 mb-2">
            {separation === 'voluntary'
              ? '退職後の資産設計、無料で相談できます'
              : '失業給付＋退職金の最適活用、無料で相談できます'}
          </h3>
          <p className="text-sm text-gray-700 mb-4">
            {separation === 'voluntary'
              ? '次の転職先を決める前に、退職金を含めた生活設計をプロのFPと一緒に整理しませんか。何度でも無料で相談できます。'
              : '退職金の手取り額に加え、失業給付や社会保険の継続など、お金まわりの最適化をFPに相談できます。'}
          </p>
          {/* ⚠ 実URLへの差し替え＝収益化トリガー。Vercel Pro 移行のオーナー判断（STOP: 決済・課金）とセットで行う。CLAUDE.md「収益化トリガー」節を参照 */}
          <a
            href="#"
            rel="sponsored nofollow noopener noreferrer"
            target="_blank"
            className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-3 rounded transition-colors"
          >
            無料でFPに相談する →
          </a>
        </section>
      )}

      {/* 解説セクション: 税理士に相談すべきケース */}
      {result && (
        <section className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="font-bold text-gray-900 mb-3">税理士に相談すべきケース</h3>
          <ul className="text-sm text-gray-700 space-y-2 list-disc pl-5">
            <li>
              <strong>iDeCo・企業型DCの一時金を過去10年以内に受け取った</strong>：
              退職所得控除の調整規定が適用され、計算が複雑になります。
            </li>
            <li>
              <strong>同一年に複数の会社から退職金を受け取る</strong>：
              退職所得の合算計算が必要です（タックスアンサー No.2741）。
            </li>
            <li>
              <strong>役員退職金で勤続5年以下、または短期勤続で控除後300万円超</strong>：
              1/2課税の特例が適用されないため、税負担が大きくなります。
            </li>
            <li>
              <strong>「退職所得の受給に関する申告書」を提出していない</strong>：
              退職金の20.42%が源泉徴収されます。確定申告で還付を受けられますが、手続きが必要です。
            </li>
            <li>
              <strong>障害退職・死亡退職など特殊なケース</strong>：
              控除額の加算や相続税の扱いなど、特例適用の判定が必要です。
            </li>
          </ul>

          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-500 mb-2">PR</p>
            <p className="text-sm text-gray-700 mb-3">
              該当するケースがある方は、複雑な計算と申告手続きを専門家に任せるのが確実です。
            </p>
            {/* ⚠ 実URLへの差し替え＝収益化トリガー。Vercel Pro 移行のオーナー判断（STOP: 決済・課金）とセットで行う。CLAUDE.md「収益化トリガー」節を参照 */}
            <a
              href="#"
              rel="sponsored nofollow noopener noreferrer"
              target="_blank"
              className="inline-block bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-6 py-3 rounded transition-colors"
            >
              税理士を無料で探す →
            </a>
          </div>
        </section>
      )}

      {/* 計算根拠の展開 */}
      {result && (
        <section className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <details>
            <summary className="cursor-pointer font-medium text-gray-700 hover:text-gray-900">
              📖 計算の法的根拠を確認する
            </summary>
            <div className="mt-3 text-sm text-gray-700 space-y-3">
              <div>
                <strong>退職所得控除額の計算（所得税法第30条第3項）</strong>
                <p className="ml-4 mt-1">勤続20年以下：40万円 × 勤続年数（最低80万円）</p>
                <p className="ml-4">勤続20年超：800万円 + 70万円 × (勤続年数 - 20)</p>
              </div>
              <div>
                <strong>課税退職所得金額の計算（所得税法第30条第2項・第4項・第5項）</strong>
                <p className="ml-4 mt-1">
                  一般退職手当等：<code className="text-xs bg-white px-1">（退職金 - 控除額）× 1/2</code>
                </p>
                <p className="ml-4">
                  特定役員退職手当等（役員等で勤続5年以下）：
                  <code className="text-xs bg-white px-1">退職金 - 控除額</code>
                </p>
                <p className="ml-4">
                  短期退職手当等（一般5年以下、控除後300万円超部分）：
                  <code className="text-xs bg-white px-1">150万円 + (退職金 - (300万円 + 控除額))</code>
                </p>
              </div>
              <div>
                <strong>所得税額（退職所得の源泉徴収税額の速算表、令和7年分）</strong>
                <p className="ml-4 mt-1">
                  <code className="text-xs bg-white px-1">(課税退職所得 × 税率 - 控除額) × 102.1%</code>
                </p>
                <p className="ml-4 text-xs">復興特別所得税（2.1%）込み。1円未満切り捨て。</p>
              </div>
              <div>
                <strong>住民税（地方税法）</strong>
                <p className="ml-4 mt-1">
                  <code className="text-xs bg-white px-1">課税退職所得 × 10%</code>
                </p>
                <p className="ml-4 text-xs">道府県民税4% + 市町村民税6%（政令市は内訳が異なるが合計は同じ）</p>
              </div>
              <div className="pt-2 border-t border-gray-200">
                <p className="text-xs text-gray-500">
                  参照：国税庁タックスアンサー
                  <a
                    href="https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1420.htm"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline mx-1"
                  >
                    No.1420
                  </a>
                  /
                  <a
                    href="https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/2740.htm"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline mx-1"
                  >
                    No.2740
                  </a>
                  /
                  <a
                    href="https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/2737.htm"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline mx-1"
                  >
                    No.2737
                  </a>
                </p>
              </div>
            </div>
          </details>
        </section>
      )}
    </div>
  );
}
