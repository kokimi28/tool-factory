/**
 * 「作ったが未接続」の検出（E5 で見つかった defect の恒久対策）。
 *
 * E5 の着手時に、G6 で作った配偶者控除モデル（lib/nenshu-kabe/spouse-deduction.ts）が
 * 記事のためだけに存在し、計算ツール本体からは一度も呼ばれていないことが分かった。
 * テストは通り、台帳には「済」と書かれ、それでもユーザーが触る面には何も届いていない。
 *
 * 純関数を作ることと、それを画面に出すことは別の作業なので、
 * **app/ と components/ からモジュールをたどって到達できるか**を CI で見る。
 * 到達しないモジュールは下の台帳（UNCONNECTED）に理由付きで載せる。
 * 台帳に無い未到達モジュールが増えたら赤（＝作ったまま繋ぎ忘れた）、
 * 台帳にあるのに到達するようになったら赤（＝繋いだので台帳から消す）。
 */
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, normalize, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = normalize(join(dirname(fileURLToPath(import.meta.url)), '..'));

/**
 * 未接続を承知で置いているモジュールと、その理由。
 * 「順次つなぐ」ものはここに残さず backlog に起票する（理由が書けないものは繋ぐか消す）。
 */
const UNCONNECTED: Record<string, string> = {
  'lib/links.ts':
    '内部リンクの検証ユーティリティ。QC13 の内部リンクテストから使う test 専用で、画面には出さない',
  'lib/nenshu-kabe/eligibility.ts':
    '106万の壁の適用判定（企業規模・週20時間・賃金要件）。記事の根拠として使用中。UI への接続は backlog 起票済',
  'lib/ideco/limits.ts':
    'iDeCo の拠出限度額（加入区分別）。記事の根拠として使用中。UI への接続は backlog 起票済',
  'lib/ideco/receipt-comparison.ts':
    '一時金と年金の受取比較（G3）。記事の根拠として使用中。UI への接続は backlog 起票済',
  'lib/nenkin-kuriage/zaishoku.ts':
    '在職老齢年金の支給停止。記事の根拠として使用中。UI への接続は backlog 起票済',
  'lib/nenkin-kuriage/kakyu.ts':
    '加給年金・振替加算。記事の根拠として使用中。UI への接続は backlog 起票済',
  'lib/tedori/bonus.ts':
    '賞与の手取り。記事の根拠として使用中。UI への接続は backlog 起票済',
};

const SOURCE_EXTS = ['.ts', '.tsx'];
const isTest = (p: string) => /\.test\.tsx?$/.test(p);

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(join(ROOT, dir))) {
    const rel = `${dir}/${entry}`;
    if (statSync(join(ROOT, rel)).isDirectory()) {
      out.push(...walk(rel));
    } else if (SOURCE_EXTS.some((e) => entry.endsWith(e)) && !isTest(rel)) {
      out.push(rel);
    }
  }
  return out;
}

const ALL = [...walk('app'), ...walk('components'), ...walk('lib')];
const SRC = new Map(ALL.map((p) => [p, readFileSync(join(ROOT, p), 'utf8')]));

/** import 指定子を、走査対象のファイルパスに解決する（外部パッケージは null）。 */
function resolveSpecifier(spec: string, from: string): string | null {
  let base: string;
  if (spec.startsWith('@/')) base = spec.slice(2);
  else if (spec.startsWith('.')) base = relative(ROOT, normalize(join(ROOT, dirname(from), spec)));
  else return null;
  for (const cand of [`${base}.ts`, `${base}.tsx`, `${base}/index.ts`]) {
    if (SRC.has(cand)) return cand;
  }
  return null;
}

const IMPORT_RE = /(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

function importsOf(file: string): string[] {
  const out: string[] = [];
  for (const m of SRC.get(file)!.matchAll(IMPORT_RE)) {
    const resolved = resolveSpecifier(m[1] ?? m[2], file);
    if (resolved) out.push(resolved);
  }
  return out;
}

/** app/ と components/ を起点に、import をたどって到達できるファイル集合。 */
function reachable(): Set<string> {
  const seen = new Set<string>();
  const stack = ALL.filter((p) => p.startsWith('app/') || p.startsWith('components/'));
  while (stack.length > 0) {
    const cur = stack.pop()!;
    if (seen.has(cur)) continue;
    seen.add(cur);
    stack.push(...importsOf(cur));
  }
  return seen;
}

/** 値（関数・定数）を export しているか。型だけのモジュールは対象外。 */
const EXPORTS_VALUE = /^export\s+(?:async\s+)?(?:function|const|class)\s/m;

describe('未接続モジュールの検出', () => {
  const reached = reachable();
  const orphans = ALL.filter(
    (p) => p.startsWith('lib/') && EXPORTS_VALUE.test(SRC.get(p)!) && !reached.has(p),
  ).sort();

  it('起点となる app/ components/ を実際に読めている（走査が空振りしていない）', () => {
    expect(ALL.filter((p) => p.startsWith('app/')).length).toBeGreaterThan(10);
    expect(ALL.filter((p) => p.startsWith('components/')).length).toBeGreaterThan(10);
    expect(reached.size).toBeGreaterThan(ALL.length / 2);
  });

  it('画面から到達できるはずのモジュールを到達扱いにできている（解決の健全性）', () => {
    // 各ツールの計算本体は必ず画面から使われている。ここが落ちるなら import 解決が壊れている。
    for (const core of [
      'lib/tedori/calculations.ts',
      'lib/nenshu-kabe/calculations.ts',
      'lib/nenshu-kabe/scenarios.ts',
      'lib/nenshu-kabe/spouse-deduction.ts',
      'lib/furusato/calculations.ts',
      'lib/ideco/calculations.ts',
      'lib/tedori/dependents.ts',
      'lib/tedori/family.ts',
    ]) {
      expect(reached.has(core)).toBe(true);
    }
  });

  it('台帳に無い未接続モジュールが増えていない', () => {
    const undocumented = orphans.filter((p) => !(p in UNCONNECTED));
    expect(undocumented).toEqual([]);
  });

  it('台帳の項目が古くなっていない（接続済みなら台帳から消す）', () => {
    const stale = Object.keys(UNCONNECTED).filter((p) => !orphans.includes(p));
    expect(stale).toEqual([]);
  });

  it('台帳の各項目に理由が書かれている', () => {
    for (const [path, reason] of Object.entries(UNCONNECTED)) {
      expect(SRC.has(path)).toBe(true);
      expect(reason.length).toBeGreaterThan(15);
    }
  });
});
