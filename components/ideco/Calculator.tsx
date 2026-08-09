'use client';

/**
 * iDeCo受取税シミュレーター - メインCalculator
 *
 * ユーザーは「西暦（年）」で期間を入力する。UI層で calc の入力
 * （年数・順序・間隔・重複・改正判定年）を自動導出して
 * lib/calculations.ts の calcIdecoSim / compareVariants に渡す。
 *
 * 差別化の肝：隣接2比較（現状／順序を逆／ルール回避まで間隔を空けた場合）。
 *
 * 永続化なし（メモリ内 state のみ）。localStorage 等は使用しない。
 */

import { useMemo, useState, type ChangeEvent } from 'react';
import {
  calcIdecoSim,
  compareVariants,
  type IdecoSimInput,
  type IdecoSimResult,
  type ReceiptBreakdown,
  type AppliedRule,
  type ReceiptOrder,
} from '@/lib/ideco/calculations';
import { IDECO_PRESETS } from '@/lib/ideco/presets';

// ============================================================
// 表示ヘルパー
// ============================================================

/** 金額を「○○円」形式（カンマ区切り）でフォーマット */
function yen(n: number): string {
  return `${Math.round(n).toLocaleString('ja-JP')}円`;
}

/** 万円を円に変換 */
function manToYen(man: number): number {
  return Math.round(man * 10_000);
}

/** 符号付きの円表示（差額用） */
function signedYen(n: number): string {
  const sign = n > 0 ? '+' : n < 0 ? '−' : '±';
  return `${sign}${yen(Math.abs(n))}`;
}

/** 差額を「約○○万円」に丸めて表示（見出しコピー用） */
function manRoundLabel(n: number): string {
  const man = Math.round(n / 10_000);
  const sign = n >= 0 ? '+' : '−';
  return `${sign}${Math.abs(man).toLocaleString('ja-JP')}万円`;
}

/** 適用ルールのバッジ表示設定 */
const RULE_BADGE: Record<AppliedRule, { label: string; className: string; desc: string }> = {
  '19年ルール': {
    label: '19年ルール',
    className: 'bg-orange-100 text-orange-800 border-orange-300',
    desc: '退職金を先に受け取り、その前年以前19年内に iDeCo を受け取るため、退職所得控除の重複調整が適用されます。',
  },
  '10年ルール': {
    label: '10年ルール（2026改正）',
    className: 'bg-rose-100 text-rose-800 border-rose-300',
    desc: 'iDeCo を先に受け取り、その前年以前9年内に退職金を受け取るため、退職所得控除の重複調整が適用されます（2026年1月1日以後支払の退職金に適用）。',
  },
  '同年合算': {
    label: '同年合算',
    className: 'bg-blue-100 text-blue-800 border-blue-300',
    desc: '同一年に両方を受け取るため、勤続期間を通算して退職所得控除を計算します（所令69③）。',
  },
  '調整なし': {
    label: '調整なし',
    className: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    desc: '受取間隔がルックバック期間を超えるため、退職所得控除はそれぞれ満額で適用されます（重複調整なし）。',
  },
};

// ============================================================
// 入力モデル（年ベース）と導出ロジック
// ============================================================

type RawInputs = {
  nyushaYear: string; // 入社年（西暦）
  taishokuYear: string; // 退職年（＝退職金受給年）
  taishokuMan: string; // 退職金額（万円）
  idecoStartYear: string; // iDeCo加入開始年
  idecoReceiptYear: string; // iDeCo受給年（一時金）
  idecoMan: string; // iDeCo一時金額（万円）
  idecoEndYear: string; // 拠出終了年（任意・未入力なら受給年）
};

type Derived = {
  taishokuYears: number;
  idecoYears: number;
  overlapYears: number;
  order: ReceiptOrder;
  gapYears: number;
  laterReceiptYear: number;
  idecoEndYear: number;
  simInput: IdecoSimInput;
};

const YEAR_MIN = 1950;
const YEAR_MAX = 2100;

/** 全角数字を半角に正規化（日本語IME対策） */
function toHalfWidthDigits(s: string): string {
  return s.replace(/[０-９]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0xfee0));
}

/** 文字列を整数に（空・非数は null）。数値変換は計算時のみ行う。 */
function toInt(s: string): number | null {
  if (s.trim() === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

/** バリデーション（やさしいエラーメッセージ） */
function validate(raw: RawInputs): string[] {
  const errors: string[] = [];
  const nyusha = toInt(raw.nyushaYear);
  const taishoku = toInt(raw.taishokuYear);
  const taishokuMan = raw.taishokuMan.trim() === '' ? null : Number(raw.taishokuMan);
  const idecoStart = toInt(raw.idecoStartYear);
  const idecoReceipt = toInt(raw.idecoReceiptYear);
  const idecoMan = raw.idecoMan.trim() === '' ? null : Number(raw.idecoMan);
  const idecoEnd = toInt(raw.idecoEndYear); // 任意

  const inYearRange = (n: number | null) => n !== null && n >= YEAR_MIN && n <= YEAR_MAX;

  if (!inYearRange(nyusha)) errors.push('入社年を西暦（1950〜2100）で入力してください。');
  if (!inYearRange(taishoku)) errors.push('退職年を西暦（1950〜2100）で入力してください。');
  if (!inYearRange(idecoStart)) errors.push('iDeCo加入開始年を西暦（1950〜2100）で入力してください。');
  if (!inYearRange(idecoReceipt)) errors.push('iDeCo受給年を西暦（1950〜2100）で入力してください。');

  if (taishokuMan === null || Number.isNaN(taishokuMan) || taishokuMan < 0) {
    errors.push('退職金額は0以上の数値（万円）で入力してください。');
  }
  if (idecoMan === null || Number.isNaN(idecoMan) || idecoMan < 0) {
    errors.push('iDeCo一時金額は0以上の数値（万円）で入力してください。');
  }

  if (nyusha !== null && taishoku !== null && taishoku < nyusha) {
    errors.push('退職年は入社年以降の年を入力してください。');
  }
  if (idecoStart !== null && idecoReceipt !== null && idecoReceipt < idecoStart) {
    errors.push('iDeCo受給年は加入開始年以降の年を入力してください。');
  }
  if (raw.idecoEndYear.trim() !== '') {
    if (idecoEnd === null || !inYearRange(idecoEnd)) {
      errors.push('拠出終了年は西暦（1950〜2100）で入力してください（未入力なら受給年とみなします）。');
    } else if (idecoStart !== null && idecoEnd < idecoStart) {
      errors.push('拠出終了年は加入開始年以降の年を入力してください。');
    } else if (idecoReceipt !== null && idecoEnd > idecoReceipt) {
      errors.push('拠出終了年は受給年以前の年を入力してください。');
    }
  }

  return errors;
}

/** 年ベース入力から calc 入力を導出する */
function derive(raw: RawInputs): Derived {
  const nyusha = toInt(raw.nyushaYear) as number;
  const taishoku = toInt(raw.taishokuYear) as number;
  const idecoStart = toInt(raw.idecoStartYear) as number;
  const idecoReceipt = toInt(raw.idecoReceiptYear) as number;
  const idecoEnd = raw.idecoEndYear.trim() === '' ? idecoReceipt : (toInt(raw.idecoEndYear) as number);

  const taishokuYears = taishoku - nyusha;
  const idecoYears = idecoEnd - idecoStart;
  // 重複年数 = 勤続期間[入社, 退職] と iDeCo期間[加入開始, 拠出終了] の重なり
  const overlapYears = Math.max(0, Math.min(taishoku, idecoEnd) - Math.max(nyusha, idecoStart));

  const order: ReceiptOrder =
    taishoku < idecoReceipt ? 'taishoku_first' : taishoku > idecoReceipt ? 'ideco_first' : 'same_year';
  const gapYears = Math.abs(taishoku - idecoReceipt);
  const laterReceiptYear = Math.max(taishoku, idecoReceipt);

  const simInput: IdecoSimInput = {
    taishokukin: { amount: manToYen(Number(raw.taishokuMan)), years: taishokuYears },
    ideco: { amount: manToYen(Number(raw.idecoMan)), years: idecoYears },
    order,
    gapYears,
    overlapYears,
    laterReceiptYear,
  };

  return { taishokuYears, idecoYears, overlapYears, order, gapYears, laterReceiptYear, idecoEndYear: idecoEnd, simInput };
}

/** 重複調整を回避するのに必要な受取間隔（年）。resolveLookbackYears+1 と同期。 */
function recommendedGapYears(order: ReceiptOrder, laterReceiptYear: number): number {
  if (order === 'ideco_first') {
    return (laterReceiptYear >= 2026 ? 9 : 4) + 1;
  }
  // taishoku_first / same_year を別年に分けるケース
  return 19 + 1;
}

const ORDER_LABEL: Record<ReceiptOrder, string> = {
  taishoku_first: '退職金 → iDeCo の順',
  ideco_first: 'iDeCo → 退職金 の順',
  same_year: '同一年に両方',
};

// ============================================================
// プレゼンテーション部品
// ============================================================

/** 1件分の受取内訳カード */
function ReceiptCard({ r }: { r: ReceiptBreakdown }) {
  const adjusted = r.overlapReduction > 0;
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <h4 className="font-bold text-gray-900 mb-3">{r.label}</h4>
      <dl className="space-y-1.5 text-sm">
        <div className="flex justify-between py-1 border-b border-gray-100">
          <dt className="text-gray-600">収入金額</dt>
          <dd className="font-medium text-gray-900">{yen(r.income)}</dd>
        </div>
        <div className="flex justify-between py-1 border-b border-gray-100">
          <dt className="text-gray-600">退職所得控除（満額）</dt>
          <dd className="font-medium text-gray-900">{yen(r.baseDeduction)}</dd>
        </div>
        {adjusted && (
          <div className="flex justify-between py-1 border-b border-gray-100">
            <dt className="text-rose-600">　└ 重複による減額</dt>
            <dd className="font-medium text-rose-600">−{yen(r.overlapReduction)}</dd>
          </div>
        )}
        <div className="flex justify-between py-1 border-b border-gray-100">
          <dt className="text-gray-600">{adjusted ? '退職所得控除（調整後）' : '退職所得控除'}</dt>
          <dd className="font-semibold text-gray-900">{yen(r.deduction)}</dd>
        </div>
        <div className="flex justify-between py-1 border-b border-gray-100">
          <dt className="text-gray-600">課税退職所得金額</dt>
          <dd className="font-medium text-gray-900">{yen(r.taxableIncome)}</dd>
        </div>
        <div className="flex justify-between py-1 border-b border-gray-100">
          <dt className="text-gray-600">所得税（復興特別所得税込）</dt>
          <dd className="font-medium text-gray-900">{yen(r.incomeTax)}</dd>
        </div>
        <div className="flex justify-between py-1 border-b border-gray-100">
          <dt className="text-gray-600">住民税</dt>
          <dd className="font-medium text-gray-900">{yen(r.residentTax)}</dd>
        </div>
        <div className="flex justify-between py-1 pt-2">
          <dt className="font-semibold text-gray-700">手取り額</dt>
          <dd className="font-bold text-blue-900">{yen(r.netAmount)}</dd>
        </div>
      </dl>
    </div>
  );
}

// ============================================================
// メインコンポーネント
// ============================================================

const DEFAULTS: RawInputs = {
  nyushaYear: '1995',
  taishokuYear: '2025',
  taishokuMan: '2000',
  idecoStartYear: '2015',
  idecoReceiptYear: '2030',
  idecoMan: '500',
  idecoEndYear: '',
};

export default function Calculator() {
  const [raw, setRaw] = useState<RawInputs>(DEFAULTS);

  // e.target.value を全角→半角に正規化してそのまま置換（連結・追記しない）。
  const set = (key: keyof RawInputs) => (e: ChangeEvent<HTMLInputElement>) =>
    setRaw((prev) => ({ ...prev, [key]: toHalfWidthDigits(e.target.value) }));

  const errors = useMemo(() => validate(raw), [raw]);
  const isValid = errors.length === 0;

  const derived = useMemo(() => (isValid ? derive(raw) : null), [raw, isValid]);

  const result: IdecoSimResult | null = useMemo(
    () => (derived ? calcIdecoSim(derived.simInput) : null),
    [derived],
  );

  const comparison = useMemo(
    () => (derived ? compareVariants(derived.simInput) : null),
    [derived],
  );

  // 隣接2比較の各シナリオと現状との差額
  const variants = useMemo(() => {
    if (!comparison || !derived) return null;
    const baseNet = comparison.base.totalNet;
    const needGap = recommendedGapYears(derived.order, derived.laterReceiptYear);
    return {
      base: comparison.base,
      reversed: {
        result: comparison.reversedOrder,
        diff: comparison.reversedOrder.totalNet - baseNet,
        label:
          derived.order === 'same_year'
            ? '別の受け取り方（順序）'
            : derived.order === 'taishoku_first'
              ? 'iDeCo → 退職金 の順にする'
              : '退職金 → iDeCo の順にする',
      },
      enoughGap: {
        result: comparison.enoughGap,
        diff: comparison.enoughGap.totalNet - baseNet,
        needGap,
      },
    };
  }, [comparison, derived]);

  // 最も有利な代替案（現状より手取りが多いもの）
  const bestAlt = useMemo(() => {
    if (!variants) return null;
    const candidates = [
      { kind: 'reversed' as const, diff: variants.reversed.diff },
      { kind: 'gap' as const, diff: variants.enoughGap.diff },
    ];
    const best = candidates.sort((a, b) => b.diff - a.diff)[0];
    return best.diff > 0 ? best : null;
  }, [variants]);

  // bg/text を明示固定。globals.css の prefers-color-scheme: dark で body の
  // foreground が薄色(#ededed)になり、色未指定だと白背景に白文字で読めなくなるのを防ぐ。
  const inputClass =
    'w-full rounded border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500';

  return (
    <div className="w-full max-w-3xl mx-auto space-y-6">
      {/* 入力フォーム */}
      <section className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
        <h2 className="text-lg font-bold text-gray-900 mb-4">受け取り条件を入力</h2>

        {/* 受取シナリオ・プリセット（E2）: ワンタップで代表ケースを入力 */}
        <div className="mb-5">
          <p className="text-sm font-semibold text-gray-800 mb-2">受取シナリオの例（ワンタップで入力）</p>
          <div className="flex flex-wrap gap-2" role="group" aria-label="受取シナリオ・プリセット">
            {IDECO_PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                title={p.description}
                onClick={() => setRaw(p.inputs)}
                className="rounded-full border border-gray-300 bg-white px-3 py-1 text-xs text-gray-700 transition hover:border-blue-400 hover:text-blue-700"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* 退職金ブロック */}
        <fieldset className="mb-5">
          <legend className="text-sm font-semibold text-gray-800 mb-2">① 退職金（会社からの一時金）</legend>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="nyushaYear" className="block text-sm font-medium text-gray-700 mb-1">
                入社年（西暦）
              </label>
              <input id="nyushaYear" type="text" inputMode="numeric" value={raw.nyushaYear} onChange={set('nyushaYear')} className={inputClass} placeholder="例: 1995" />
            </div>
            <div>
              <label htmlFor="taishokuYear" className="block text-sm font-medium text-gray-700 mb-1">
                退職年（＝退職金の受給年）
              </label>
              <input id="taishokuYear" type="text" inputMode="numeric" value={raw.taishokuYear} onChange={set('taishokuYear')} className={inputClass} placeholder="例: 2025" />
            </div>
          </div>
          <div className="mt-3">
            <label htmlFor="taishokuMan" className="block text-sm font-medium text-gray-700 mb-1">
              退職金額（万円）
            </label>
            <input id="taishokuMan" type="text" inputMode="numeric" value={raw.taishokuMan} onChange={set('taishokuMan')} className={inputClass} placeholder="例: 2000" />
          </div>
        </fieldset>

        {/* iDeCoブロック */}
        <fieldset className="mb-2">
          <legend className="text-sm font-semibold text-gray-800 mb-2">② iDeCo・企業型DC（一時金で受け取る場合）</legend>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="idecoStartYear" className="block text-sm font-medium text-gray-700 mb-1">
                加入開始年（西暦）
              </label>
              <input id="idecoStartYear" type="text" inputMode="numeric" value={raw.idecoStartYear} onChange={set('idecoStartYear')} className={inputClass} placeholder="例: 2015" />
            </div>
            <div>
              <label htmlFor="idecoReceiptYear" className="block text-sm font-medium text-gray-700 mb-1">
                受給年（一時金を受け取る年）
              </label>
              <input id="idecoReceiptYear" type="text" inputMode="numeric" value={raw.idecoReceiptYear} onChange={set('idecoReceiptYear')} className={inputClass} placeholder="例: 2030" />
            </div>
          </div>
          <div className="mt-3">
            <label htmlFor="idecoMan" className="block text-sm font-medium text-gray-700 mb-1">
              iDeCo一時金額（万円）
            </label>
            <input id="idecoMan" type="text" inputMode="numeric" value={raw.idecoMan} onChange={set('idecoMan')} className={inputClass} placeholder="例: 500" />
          </div>
          <div className="mt-3">
            <label htmlFor="idecoEndYear" className="block text-sm font-medium text-gray-700 mb-1">
              拠出終了年（任意・上級）
            </label>
            <input id="idecoEndYear" type="text" inputMode="numeric" value={raw.idecoEndYear} onChange={set('idecoEndYear')} className={inputClass} placeholder="未入力なら受給年とみなします" />
            <p className="text-xs text-gray-500 mt-1">
              ※ 掛金の拠出を受給年より前にやめた場合のみ入力してください。iDeCoの「加入年数」は
              <strong>加入開始年〜拠出終了年</strong>で計算します（未入力時は受給年まで拠出したものとして扱います）。
            </p>
          </div>
        </fieldset>

        {errors.length > 0 && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
            {errors.map((e, i) => (
              <p key={i}>・{e}</p>
            ))}
          </div>
        )}
      </section>

      {/* 導出された計算条件（透明性） */}
      {derived && result && (
        <section className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <details>
            <summary className="cursor-pointer text-sm font-medium text-gray-700 hover:text-gray-900">
              🔍 入力から自動導出した計算条件
            </summary>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-gray-700">
              <dt className="text-gray-500">勤続年数</dt>
              <dd>{derived.taishokuYears} 年</dd>
              <dt className="text-gray-500">iDeCo加入年数</dt>
              <dd>{derived.idecoYears} 年（拠出終了 {derived.idecoEndYear} 年）</dd>
              <dt className="text-gray-500">重複年数</dt>
              <dd>{derived.overlapYears} 年</dd>
              <dt className="text-gray-500">受取順序</dt>
              <dd>{ORDER_LABEL[derived.order]}</dd>
              <dt className="text-gray-500">受取間隔</dt>
              <dd>{derived.gapYears} 年</dd>
              <dt className="text-gray-500">改正判定年（後の受給年）</dt>
              <dd>{derived.laterReceiptYear} 年</dd>
            </dl>
          </details>
        </section>
      )}

      {/* 計算結果 */}
      {result && (
        <section className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="text-lg font-bold text-gray-900">計算結果</h2>
            <span className={`inline-block text-sm font-semibold px-3 py-1 rounded-full border ${RULE_BADGE[result.appliedRule].className}`}>
              {RULE_BADGE[result.appliedRule].label}
            </span>
          </div>
          <p className="text-sm text-gray-600">{RULE_BADGE[result.appliedRule].desc}</p>

          {/* 受給ごとの内訳（時系列順） */}
          <div className="space-y-3">
            {result.receipts.map((r, i) => (
              <ReceiptCard key={i} r={r} />
            ))}
          </div>

          {/* 合計 */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
            <div className="flex justify-between text-sm text-blue-900">
              <span>収入合計</span>
              <span className="font-medium">{yen(result.totalIncome)}</span>
            </div>
            <div className="flex justify-between text-sm text-blue-900">
              <span>税額合計（所得税＋住民税）</span>
              <span className="font-medium">{yen(result.totalTax)}</span>
            </div>
            <div className="flex justify-between items-baseline pt-2 border-t border-blue-200">
              <span className="text-blue-700 font-medium">手取り合計</span>
              <span className="text-3xl font-bold text-blue-900">{yen(result.totalNet)}</span>
            </div>
          </div>

          <p className="text-xs text-gray-500">
            ※ あくまで参考値です。実際の税額は他の所得との通算や個別事情により変動する場合があります。
          </p>

          {result.notes.length > 0 && (
            <details className="text-xs text-gray-500">
              <summary className="cursor-pointer hover:text-gray-700">計算上の前提・注記を表示</summary>
              <ul className="mt-2 space-y-1.5 list-disc pl-5">
                {result.notes.map((n, i) => (
                  <li key={i}>{n}</li>
                ))}
              </ul>
            </details>
          )}
        </section>
      )}

      {/* 隣接2比較（差別化の肝） */}
      {variants && derived && (
        <section className="bg-amber-50 border border-amber-200 rounded-lg p-6">
          <h3 className="font-bold text-amber-900 mb-1">💡 受け取り方の最適化ヒント</h3>
          <p className="text-sm text-amber-900 mb-4">
            {bestAlt ? (
              bestAlt.kind === 'reversed' ? (
                <>
                  <strong>受取順序を逆にする</strong>と、手取りが{' '}
                  <strong>{manRoundLabel(variants.reversed.diff)}</strong> 変わる可能性があります。
                </>
              ) : (
                <>
                  <strong>受取間隔を{variants.enoughGap.needGap}年以上空ける</strong>と、重複調整がなくなり手取りが{' '}
                  <strong>{manRoundLabel(variants.enoughGap.diff)}</strong> 変わる可能性があります。
                </>
              )
            ) : (
              <>現在の受け取り方が、比較した中では最も有利です。</>
            )}
          </p>

          <div className="space-y-2">
            {/* 現状 */}
            <div className="flex justify-between items-center bg-white/70 rounded px-3 py-2 text-sm">
              <span className="font-medium text-amber-900">現在の受け取り方（{ORDER_LABEL[derived.order]}・間隔{derived.gapYears}年）</span>
              <span className="font-bold text-amber-900">{yen(variants.base.totalNet)}</span>
            </div>
            {/* 順序を逆 */}
            <div className="flex justify-between items-center bg-white/70 rounded px-3 py-2 text-sm">
              <span className="text-amber-900">{variants.reversed.label}</span>
              <span className="text-right">
                <span className="font-bold text-amber-900">{yen(variants.reversed.result.totalNet)}</span>
                <span className={`ml-2 text-xs ${variants.reversed.diff > 0 ? 'text-emerald-700' : variants.reversed.diff < 0 ? 'text-rose-600' : 'text-gray-500'}`}>
                  （{signedYen(variants.reversed.diff)}）
                </span>
              </span>
            </div>
            {/* 間隔を空ける */}
            <div className="flex justify-between items-center bg-white/70 rounded px-3 py-2 text-sm">
              <span className="text-amber-900">受取間隔を{variants.enoughGap.needGap}年以上空ける（調整なし）</span>
              <span className="text-right">
                <span className="font-bold text-amber-900">{yen(variants.enoughGap.result.totalNet)}</span>
                <span className={`ml-2 text-xs ${variants.enoughGap.diff > 0 ? 'text-emerald-700' : variants.enoughGap.diff < 0 ? 'text-rose-600' : 'text-gray-500'}`}>
                  （{signedYen(variants.enoughGap.diff)}）
                </span>
              </span>
            </div>
          </div>
          <p className="text-xs text-amber-700 mt-3">
            ※ 受け取りタイミングは健康状態・運用期間・他の収入など総合的に判断が必要です。最適化は税理士・FPにご相談ください。
          </p>
        </section>
      )}

      {/* 「退職所得の受給に関する申告書」の注意 */}
      {result && (
        <section className="bg-orange-50 border border-orange-200 rounded-lg p-6">
          <h3 className="font-bold text-orange-900 mb-2">⚠️ 「退職所得の受給に関する申告書」を忘れずに</h3>
          <p className="text-sm text-orange-900">
            退職金・iDeCo一時金の受取時に勤務先・運営管理機関へこの申告書を提出すると、退職所得控除を反映した正しい税額で源泉徴収されます。
            <strong>提出しないと一律20.42%が源泉徴収</strong>され、払い過ぎた分は確定申告で精算する必要があります。
          </p>
        </section>
      )}

      {/* CTA①: FP相談（受取設計） */}
      {result && (
        <section className="bg-white border border-gray-200 rounded-lg p-6">
          <p className="text-xs text-gray-500 mb-2">PR</p>
          <h3 className="font-bold text-gray-900 mb-2">受け取りタイミングの最適化、無料で相談できます</h3>
          <p className="text-sm text-gray-700 mb-4">
            iDeCoと退職金をいつ・どの順番で受け取るかで手取りは大きく変わります。あなたの状況に合わせた受取設計を、お金の専門家（FP）に無料で相談できます。
          </p>
          {/* TODO: ASP承認後にアフィリリンクを差し込み */}
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

      {/* 解説＋CTA②: 税理士に相談すべきケース */}
      {result && (
        <section className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="font-bold text-gray-900 mb-3">税理士に相談すべきケース</h3>
          <ul className="text-sm text-gray-700 space-y-2 list-disc pl-5">
            <li>
              <strong>勤続期間とiDeCo加入期間が重なっている</strong>：重複排除の調整（19年／10年ルール）で控除額が減り、計算が複雑になります。
            </li>
            <li>
              <strong>退職金とiDeCoを同じ年に受け取る</strong>：勤続期間を通算する合算計算が必要です（所令69③）。短期勤続が含まれる場合はさらに特例判定が必要です。
            </li>
            <li>
              <strong>勤続5年以下が含まれる</strong>：短期退職手当等・特定役員退職手当等の特例（1/2課税の制限）があり、本ツールの標準計算とは異なります。
            </li>
            <li>
              <strong>年金受取・一時金との併用、繰下げを検討中</strong>：本ツールは「一時金×2本」の試算のみに対応しています。
            </li>
          </ul>

          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-500 mb-2">PR</p>
            <p className="text-sm text-gray-700 mb-3">
              重複調整・同年合算・短期勤続などが絡むケースは、専門家に任せるのが確実です。
            </p>
            {/* TODO: ASP承認後にアフィリリンクを差し込み */}
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
                <strong>退職所得控除額（所得税法第30条第3項）</strong>
                <p className="ml-4 mt-1">勤続20年以下：40万円 × 年数（最低80万円）</p>
                <p className="ml-4">勤続20年超：800万円 + 70万円 ×（年数 − 20）</p>
                <p className="ml-4 text-xs">iDeCoは掛金拠出期間を勤続年数とみなす（所令72七）。</p>
              </div>
              <div>
                <strong>重複期間の調整（所得税法施行令第70条）</strong>
                <p className="ml-4 mt-1">
                  後に受け取る一時金の控除 ={' '}
                  <code className="text-xs bg-white px-1">base(後の年数) − base(重複年数)</code>
                </p>
                <p className="ml-4 text-xs">
                  退職金先→iDeCo後は前年以前19年内（19年ルール）、iDeCo先→退職金後は前年以前9年内（10年ルール・2026年1月1日以後支払の退職金に適用）。
                </p>
              </div>
              <div>
                <strong>課税退職所得金額（所得税法第30条第2項）</strong>
                <p className="ml-4 mt-1">
                  <code className="text-xs bg-white px-1">max(0, 収入 − 控除) × 1/2</code>（1,000円未満切り捨て）
                </p>
              </div>
              <div>
                <strong>所得税（速算表・復興特別所得税2.1%込）</strong>
                <p className="ml-4 mt-1">
                  <code className="text-xs bg-white px-1">課税退職所得 × 税率 − 速算控除額</code> に 2.1% を加算（1円未満切り捨て）
                </p>
              </div>
              <div>
                <strong>住民税（地方税法）</strong>
                <p className="ml-4 mt-1">
                  <code className="text-xs bg-white px-1">課税退職所得 × 10%</code>
                </p>
              </div>
              <div className="pt-2 border-t border-gray-200">
                <p className="text-xs text-gray-500">
                  参照：国税庁タックスアンサー
                  <a href="https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1420.htm" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline mx-1">No.1420</a>/
                  <a href="https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/2732.htm" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline mx-1">No.2732</a>/
                  <a href="https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/2735.htm" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline mx-1">No.2735</a>
                  （最終確認日：2026-06-21）
                </p>
              </div>
            </div>
          </details>
        </section>
      )}
    </div>
  );
}
