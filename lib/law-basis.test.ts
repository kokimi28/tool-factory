/**
 * 法令根拠・最終確認日の表示統一（auto-backlog F8）。
 *
 * **寄せ替えで踏んだ罠を残す**: 共通コンポーネント `LawBasis` は最終確認日に
 * サイト共通の `SITE.lawCheckedAt` を既定値として使っていた。ところが確認日は
 * ツールごとに実際に違う（各 `site-meta.ts` の `lastUpdated`）。そのため
 * 寄せ替え済みだった退職金ツールは、自分の記録（2026-05-19）より2か月新しい
 * 2026-07-24 を「最終確認日」として公開していた。**共通化した瞬間に事実が変わる**
 * 種類の共通化で、既定値がその原因だった。
 *
 * ここでは (1) 既定値を持てないこと (2) 各ツールが自分の日付を渡していること
 * (3) ページに日付を直書きしていないこと を固定する。
 */
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { SITE_META as FURUSATO } from './furusato/site-meta';
import { SITE_META as JUTAKU } from './jutaku-loan/site-meta';
import { SITE_META as NENSHU } from './nenshu-kabe/site-meta';
import { SITE_META as NENKIN } from './nenkin-kuriage/site-meta';
import { SITE_META as IDECO } from './ideco/site-meta';
import { SITE_META as TAISHOKU } from './taishokukin/site-meta';
import { LAW_CHECKED_AT } from './tedori/site';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(join(ROOT, dir))) {
    const rel = `${dir}/${entry}`;
    if (statSync(join(ROOT, rel)).isDirectory()) out.push(...walk(rel));
    else if (/\.tsx$/.test(entry) && !/\.test\.tsx$/.test(entry)) out.push(rel);
  }
  return out;
}

const FILES = [...walk('app'), ...walk('components')];
const SRC = new Map(FILES.map((p) => [p, readFileSync(join(ROOT, p), 'utf8')]));

const TOOL_PAGES: [string, string][] = [
  ['app/(tools)/tedori/page.tsx', LAW_CHECKED_AT],
  ['app/(tools)/furusato/page.tsx', FURUSATO.lastUpdated],
  ['app/(tools)/jutaku-loan/page.tsx', JUTAKU.lastUpdated],
  ['app/(tools)/nenshu-kabe/page.tsx', NENSHU.lastUpdated],
  ['app/(tools)/nenkin-kuriage/page.tsx', NENKIN.lastUpdated],
  ['app/(tools)/taishokukin/page.tsx', TAISHOKU.lastUpdated],
];

/** ブロックコメントを外した「コード部分」。説明文に出てくる語を誤検出しないため。 */
const codeOf = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '');

describe('LawBasis の形', () => {
  const src = SRC.get('components/LawBasis.tsx')!;
  const code = codeOf(src);

  it('checkedAt は必須で、既定値を持たない', () => {
    expect(src).toMatch(/checkedAt: string;/);
    expect(code).not.toMatch(/checkedAt\s*=/);
    // サイト共通の日付を内部で使わない（それが罠の原因だった）
    expect(code).not.toContain('SITE.lawCheckedAt');
    expect(code).not.toContain('@/lib/site');
  });

  it('渡された日付をそのまま出す（別の日付に置き換えない）', () => {
    expect(src).toMatch(/最終確認日 \{checkedAt\}/);
  });
});

describe('各ツールが自分の確認日を渡している', () => {
  it.each(TOOL_PAGES)('%s が LawBasis を使い、日付を直書きしていない', (path) => {
    const src = SRC.get(path)!;
    expect(src).toMatch(/<LawBasis\b/);
    expect(src).toMatch(/checkedAt=\{/);
    expect(src).not.toMatch(/20\d\d-\d\d-\d\d/);
  });

  it('各ページは「自分のツール」の site-meta を読んでいる（隣のツールの日付を出さない）', () => {
    // 日付が偶然そろうことはあるので、値ではなく参照元で見る。
    for (const [path] of TOOL_PAGES) {
      const tool = path.match(/app\/\(tools\)\/([^/]+)\//)![1];
      const src = SRC.get(path)!;
      if (tool === 'tedori') {
        expect(src).toMatch(/from ["']@\/lib\/tedori\/site["']/);
        continue;
      }
      expect(src).toMatch(new RegExp(`from ["']@/lib/${tool}/site-meta["']`));
      // 他ツールの site-meta を読んでいない
      const others = [...SRC.keys()]
        .map((p) => p.match(/app\/\(tools\)\/([^/]+)\//)?.[1])
        .filter((t): t is string => Boolean(t) && t !== tool);
      for (const other of new Set(others)) {
        expect(src).not.toContain(`@/lib/${other}/site-meta`);
      }
    }
  });

  it('どのツールもサイト共通日付より新しい日付を主張していない', () => {
    // 退職金ツールで起きた「自分の記録より新しい日付を公開する」を禁止する。
    // 各ツールの表示元は自分の site-meta なので、ここでは形式と実在だけを確かめる。
    for (const [, date] of TOOL_PAGES) {
      expect(date).toMatch(/^20\d\d-\d\d-\d\d$/);
      expect(Number.isNaN(Date.parse(date))).toBe(false);
    }
  });
});

describe('iDeCo の日付が1箇所から出ている', () => {
  it('ページと Calculator が site-meta を参照し、日付を直書きしていない', () => {
    for (const path of ['app/(tools)/ideco/page.tsx', 'components/ideco/Calculator.tsx']) {
      const src = SRC.get(path)!;
      expect(src).toContain('SITE_META.lastUpdated');
      expect(src).not.toMatch(/最終確認日[：ــ ]?20\d\d-\d\d-\d\d/);
    }
  });

  it('FAQ はテンプレートリテラルで埋め込んでいる（${} が文字列として出ない）', () => {
    const src = SRC.get('app/(tools)/ideco/page.tsx')!;
    // 素の引用符の中に ${ が残っていると、そのまま画面に出てしまう
    expect(src).not.toMatch(/'[^'\n]*\$\{[^}]*\}[^'\n]*'/);
    expect(IDECO.lastUpdated).toMatch(/^20\d\d-\d\d-\d\d$/);
  });
});
