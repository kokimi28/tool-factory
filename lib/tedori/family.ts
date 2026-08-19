/**
 * 手取り計算に扶養家族を入れるための橋渡し（auto-backlog H1）。
 *
 * 扶養控除そのもの（区分・額・特定親族特別控除の逓減）は lib/tedori/dependents.ts に
 * 条文どおり実装済みだが、どの画面からも呼ばれておらず、計算ツールは
 * 「扶養なしの場合の概算です」と断ったままだった（tool-factory#149 の未接続監査で検出）。
 *
 * ここでは UI が扱う形（年齢と年収）と、モデルが扱う形（年齢と合計所得金額）の
 * 変換だけを持つ。控除額の判断は dependents.ts、税額の組み立ては calculations.ts に任せる。
 */

import {
  calculateNetSalary,
  salaryIncomeDeduction,
  type NetSalaryInput,
  type NetSalaryResult,
} from './calculations';
import { familyDeduction, type FamilyMember } from './dependents';

/** 画面から受け取る扶養家族1人の入力。金額はユーザーが知っている「年収」で受ける。 */
export interface FamilyInput {
  /** 年齢（歳） */
  age: number;
  /** その人の給与年収（円）。給与以外の所得は扱わない（概算ツールの範囲） */
  annualIncome: number;
}

const nonNeg = (n: number): number => (Number.isFinite(n) && n > 0 ? Math.floor(n) : 0);

/**
 * 年収を合計所得金額に直して、モデルが受け取る形にする。
 * 扶養控除の条文はすべて合計所得金額で書かれているため、この変換を挟まないと
 * 「年収58万円まで」のような取り違えが起きる。
 */
export function toFamilyMembers(inputs: readonly FamilyInput[]): FamilyMember[] {
  return inputs.map((f) => {
    const income = nonNeg(f.annualIncome);
    return { age: nonNeg(f.age), totalIncome: Math.max(0, income - salaryIncomeDeduction(income)) };
  });
}

export interface FamilyImpact {
  /** 扶養控除の合計（円） */
  deduction: { incomeTax: number; residentTax: number };
  /** 扶養を入れた場合の計算結果 */
  withFamily: NetSalaryResult;
  /** 扶養なしの場合の計算結果（比較用） */
  withoutFamily: NetSalaryResult;
  /** 扶養を申告することで増える手取り（円） */
  takeHomeGain: number;
}

/**
 * 扶養家族を入れた場合の手取りと、入れなかった場合との差を返す。
 *
 * @param base   扶養以外の入力（年収・40歳以上か・都道府県）
 * @param family 扶養家族の一覧
 */
export function familyImpact(
  base: Omit<NetSalaryInput, 'personalDeduction'>,
  family: readonly FamilyInput[] = [],
): FamilyImpact {
  const deduction = familyDeduction(toFamilyMembers(family));
  const withFamily = calculateNetSalary({ ...base, personalDeduction: deduction });
  const withoutFamily = calculateNetSalary(base);
  return {
    deduction,
    withFamily,
    withoutFamily,
    takeHomeGain: withFamily.takeHome - withoutFamily.takeHome,
  };
}

// ============================================================
// 共有 URL（E3 の ?fam= に載せる）
// ============================================================

/** 1人を "年齢-年収" にして "_" で連結する。空配列は空文字（クエリに出さない）。 */
export function encodeFamily(family: readonly FamilyInput[]): string {
  return family.map((f) => `${nonNeg(f.age)}-${nonNeg(f.annualIncome)}`).join('_');
}

/** encodeFamily の逆。壊れた入力は落として無視する（共有 URL は改変されうる）。 */
export function decodeFamily(raw: string | undefined): FamilyInput[] {
  if (!raw) return [];
  return raw
    .split('_')
    .map((part) => part.split('-'))
    .filter((pair) => pair.length === 2 && pair.every((v) => /^\d+$/.test(v)))
    .map(([age, income]) => ({ age: Number(age), annualIncome: Number(income) }))
    .filter((f) => f.age > 0 && f.age <= 120);
}
