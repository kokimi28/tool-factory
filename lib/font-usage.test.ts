/**
 * 使われていないウェブフォントの検出（auto-backlog F6）。
 *
 * `next/font` は CSS 変数を定義するだけなので、**変数を消費する font-family 指定を
 * 書き忘れても何も壊れない**。壊れないまま全ページでフォントが読み込まれ、
 * preload まで出るので、気づかないと恒久的に無駄な往復が増える。
 * 実際 Geist / Geist_Mono が定義だけされ一度も参照されずに読み込まれていた
 * （ビルド後の CSS に `var(--font-geist…)` が0件、本文は Tailwind 既定の
 * システムフォントで描画されていた）。
 *
 * ここでは「layout で定義したフォント変数が、どこかで実際に参照されているか」を検査する。
 * フォントを足すこと自体は禁止しない（消費とセットなら通る）。
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';
import { glob } from 'node:fs/promises';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));

async function sourceFiles(): Promise<string[]> {
  const out: string[] = [];
  for (const dir of ['app', 'components', 'lib']) {
    for await (const f of glob(`${dir}/**/*.{ts,tsx,css}`, { cwd: repoRoot })) {
      out.push(join(repoRoot, f));
    }
  }
  return out;
}

describe('定義したフォント変数が実際に使われている', () => {
  it('layout.tsx が定義する --font-* は、どこかで参照されている', async () => {
    const layout = readFileSync(join(repoRoot, 'app', 'layout.tsx'), 'utf-8');
    const defined = [...layout.matchAll(/variable:\s*["'](--font-[\w-]+)["']/g)].map((m) => m[1]!);
    if (defined.length === 0) return; // フォントを使っていない構成（現状）

    const sources = await sourceFiles();
    const haystack = sources
      .filter((f) => !f.endsWith('font-usage.test.ts'))
      .map((f) => readFileSync(f, 'utf-8'))
      .join('\n');

    for (const v of defined) {
      expect(
        haystack.includes(`var(${v})`),
        `${v} を定義しているが font-family で参照していない。参照を足すか、フォントの読み込みごと外す`,
      ).toBe(true);
    }
  });

  it('現状はウェブフォントを読み込んでいない（システムフォントで描画）', () => {
    const layout = readFileSync(join(repoRoot, 'app', 'layout.tsx'), 'utf-8');
    // 読み込むこと自体は禁止しないが、上の検査とセットでないと通らないよう意図を残す
    expect(layout).not.toContain('next/font/google');
  });
});
