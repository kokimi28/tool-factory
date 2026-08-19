/**
 * 入力バリデーションの網羅（auto-backlog E9）。
 *
 * `validateNumberInput` は「不正な入力を静かに 0 へ落とす」のをやめて理由を見せるための
 * 共通関数だが、**ツールごとに手で配線する**ので付け忘れが起きる。実際 backlog には
 * 「3/7 ツール・残4」と書かれていたが、着手時に調べると 5/7 済み・残2 だった
 * （＝台帳の分母は当てにならない）。
 *
 * そこで台帳ではなく**実ファイル**を数える。全ツールの Calculator が
 * 共通関数を使い、エラーを支援技術に伝える属性まで持っていることを CI で固定する。
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { liveTools } from './tools-registry';
import { validateNumberInput } from './validate-input';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));

function calculatorSource(slug: string): string {
  return readFileSync(join(repoRoot, 'components', slug, 'Calculator.tsx'), 'utf-8');
}

describe('全ツールが共通のバリデーションを使っている', () => {
  it('各 Calculator が共通関数を import して実際に呼んでいる', () => {
    // 単に識別子が含まれることを見るだけでは、import 行を消しても呼び出し側の文字列で
    // 通ってしまう（変異で実証済み）。import と呼び出しを別々に確かめる。
    for (const t of liveTools()) {
      const src = calculatorSource(t.slug);
      expect(src, `${t.slug}: validate-input を import していない`).toMatch(
        /import\s*\{[^}]*validateNumberInput[^}]*\}\s*from\s*['"]@\/lib\/validate-input['"]/,
      );
      expect(src, `${t.slug}: validateNumberInput を呼んでいない`).toMatch(
        /validateNumberInput\s*\(/,
      );
    }
  });

  it('エラーを支援技術に伝えている（aria-invalid と role="alert"）', () => {
    for (const t of liveTools()) {
      const src = calculatorSource(t.slug);
      expect(src, `${t.slug}: aria-invalid が無い`).toContain('aria-invalid');
      expect(src, `${t.slug}: role="alert" が無い`).toContain('role="alert"');
      expect(src, `${t.slug}: aria-describedby でエラーを結び付けていない`).toContain('aria-describedby');
    }
  });
});

describe('共通関数の振る舞い（各ツールが依存する前提）', () => {
  it('空文字は未入力としてエラーにしない', () => {
    expect(validateNumberInput('')).toEqual({ value: 0, error: null });
  });

  it('数字でない入力は理由つきで最小値に落ちる', () => {
    const r = validateNumberInput('abc');
    expect(r.value).toBe(0);
    expect(r.error).toBe('数字で入力してください。');
  });

  it('負値・上限超過はクランプしたうえで理由を返す', () => {
    expect(validateNumberInput('-1')).toMatchObject({ value: 0 });
    expect(validateNumberInput('-1').error).toContain('以上');
    const over = validateNumberInput('999', { max: 100 });
    expect(over.value).toBe(100);
    expect(over.error).toContain('以内');
  });

  it('全角数字とカンマを受け付ける（利用者が実際に貼る形）', () => {
    expect(validateNumberInput('１２３４')).toEqual({ value: 1234, error: null });
    expect(validateNumberInput('1,234,567')).toEqual({ value: 1234567, error: null });
  });

  it('min を指定したときの下限もクランプされる', () => {
    const r = validateNumberInput('1800', { min: 1900, max: 2100 });
    expect(r.value).toBe(1900);
    expect(r.error).toContain('以上');
  });
});
