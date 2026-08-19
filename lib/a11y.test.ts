/**
 * a11y の構造的な退行を CI で止める（auto-backlog F7）。
 *
 * 通しの監査は scripts/a11y-audit.mjs（axe-core・ブラウザが要るので CI 外）で行い、
 * ここでは**実際に見つかって直した違反**が戻らないことだけを、依存ゼロで見る。
 * 監査で 0 件にしたのは以下（対象16ページ・2026-08-19）:
 *   - color-contrast [serious] 113箇所
 *   - landmark-one-main / region [moderate]
 *   - label [critical] 2箇所
 *   - heading-order [moderate] 4箇所
 */
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(join(ROOT, dir))) {
    const rel = `${dir}/${entry}`;
    if (statSync(join(ROOT, rel)).isDirectory()) out.push(...walk(rel));
    else if (/\.tsx$/.test(entry)) out.push(rel);
  }
  return out;
}

const FILES = [...walk('app'), ...walk('components')].filter((p) => !/\.test\.tsx$/.test(p));
const SRC = new Map(FILES.map((p) => [p, readFileSync(join(ROOT, p), 'utf8')]));

describe('ランドマーク（landmark-one-main / region）', () => {
  it('main はルートレイアウトだけが持つ（入れ子や重複を作らない）', () => {
    const withMain = FILES.filter((p) => /<main[\s>]/.test(SRC.get(p)!));
    expect(withMain).toEqual(['app/layout.tsx']);
  });

  it('ルートレイアウトの main はスキップリンクの飛び先になっている', () => {
    const src = SRC.get('app/layout.tsx')!;
    expect(src).toMatch(/<main id="main-content"/);
    expect(src).toMatch(/href="#main-content"/);
  });
});

describe('コントラスト（color-contrast）', () => {
  // 白背景・12px で 4.5:1 を満たさないことが監査で確定しているクラス。
  // 背景に依存せず必ず落ちるものだけを禁止する（文脈依存のものは axe 監査に任せる）。
  const FORBIDDEN: Record<string, string> = {
    'text-slate-400': '#90a1b9 on #fff = 2.63',
    'text-gray-400': '#99a1af on #fff = 2.60',
    'text-black/40': '#999999 on #fff = 2.84',
  };

  it.each(Object.entries(FORBIDDEN))('%s は使わない（%s）', (cls) => {
    const users = FILES.filter((p) => SRC.get(p)!.includes(cls));
    expect(users).toEqual([]);
  });

  it('置き換え先（500番台）は実際に使われている＝一律削除で済ませていない', () => {
    const used = FILES.filter((p) => /text-(slate|gray)-500/.test(SRC.get(p)!));
    expect(used.length).toBeGreaterThan(10);
  });
});

describe('フォームのラベル（label）', () => {
  it('退職金ツールの勤続年数・端数月が label と結びついている', () => {
    const src = SRC.get('components/taishokukin/Calculator.tsx')!;
    for (const id of ['taishokukin-years', 'taishokukin-months']) {
      expect(src).toMatch(new RegExp(`<label htmlFor="${id}"`));
      expect(src).toMatch(new RegExp(`<input\\s+id="${id}"`));
    }
  });
});

describe('見出しの順序（heading-order）', () => {
  // ページの h1 直下に置かれるセクションは h2。h3 から始めると 1 段飛ぶ。
  const TOP_LEVEL_SECTIONS = [
    'components/nenshu-kabe/WallJudge.tsx',
    'components/nenshu-kabe/ScenarioCompare.tsx',
    'components/nenshu-kabe/WallCurveTable.tsx',
    'components/jutaku-loan/PrincipalScenarioTable.tsx',
    'components/nenkin-kuriage/WorkingPension.tsx',
    'components/nenkin-kuriage/FamilyAddition.tsx',
  ];

  it.each(TOP_LEVEL_SECTIONS)('%s の見出しは h2', (path) => {
    const src = SRC.get(path)!;
    expect(src).toMatch(/<h2[\s>]/);
    expect(src).not.toMatch(/<h3[\s>]/);
  });

  it('h1 を持つのはページ側だけで、コンポーネントは持たない', () => {
    const componentsWithH1 = FILES.filter(
      (p) => p.startsWith('components/') && /<h1[\s>]/.test(SRC.get(p)!),
    );
    expect(componentsWithH1).toEqual([]);
  });
});
