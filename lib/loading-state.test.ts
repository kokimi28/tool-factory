/**
 * 遷移中の待ち表示（auto-backlog F12）。
 *
 * **loading.tsx を採用しなかった経緯を残す**: 本サイトは全ページが静的生成で、
 * 遷移時にサーバ側で待つものが無い。`app/loading.tsx`・`app/(tools)/loading.tsx`・
 * 変わるセグメント直下の loading.tsx を置いて RSC ペイロードの取得を2.5秒
 * 遅らせても fallback は一度も描画されなかった（Next は取得が終わるまで現在の
 * ページを表示したままにする）。置いても実行されないファイルになるので入れていない。
 *
 * 代わりに Next 15.3+ の `useLinkStatus`（`<Link>` の子でだけ pending を返す）を使う。
 * ここではその配線が外れていないことだけを見る（実際に出るかは実ブラウザで確認済み）。
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
    else if (/\.tsx$/.test(entry) && !/\.test\.tsx$/.test(entry)) out.push(rel);
  }
  return out;
}

const FILES = [...walk('app'), ...walk('components')];
const SRC = new Map(FILES.map((p) => [p, readFileSync(join(ROOT, p), 'utf8')]));
const PENDING = 'components/LinkPending.tsx';

describe('待ち表示の実装', () => {
  it('useLinkStatus を使うのは共有コンポーネント1つだけ', () => {
    const users = FILES.filter((p) => SRC.get(p)!.includes('useLinkStatus'));
    expect(users).toEqual([PENDING]);
  });

  it('描画されない loading.tsx を置いていない', () => {
    expect(FILES.filter((p) => /\/loading\.tsx$/.test(p))).toEqual([]);
  });

  it('支援技術には「読み込み中」を伝え、飾りは読み上げない', () => {
    const src = SRC.get(PENDING)!;
    expect(src).toMatch(/role="status"/);
    expect(src).toMatch(/<span className="sr-only">読み込み中<\/span>/);
    expect(src).toMatch(/aria-hidden="true"/);
    // 動きは prefers-reduced-motion を尊重する
    expect(src).toMatch(/motion-safe:animate-spin/);
    expect(src).not.toMatch(/(?<!motion-safe:)animate-spin/);
  });

  it('pending でないときは何も描かない（常時スピナーにしない）', () => {
    expect(SRC.get(PENDING)!).toMatch(/if \(!pending\) return null;/);
  });
});

describe('待ち表示が置かれている面', () => {
  // 実ブラウザで pending が出ることを確認した導線。ここから外れたら気づけるようにする。
  const SURFACES = [
    'components/RelatedTools.tsx',
    'app/page.tsx',
    'app/articles/page.tsx',
    'app/(tools)/tedori/page.tsx',
  ];

  it.each(SURFACES)('%s が待ち表示を含む', (path) => {
    const src = SRC.get(path)!;
    expect(src).toMatch(/import LinkPending from/);
    expect(src).toMatch(/<LinkPending \/>/);
  });

  it('ツール別の記事一覧はすべて待ち表示を持つ（1つ作り忘れても気づく）', () => {
    const hubs = FILES.filter((p) => /^app\/\(tools\)\/[^/]+\/articles\/page\.tsx$/.test(p));
    expect(hubs.length).toBeGreaterThanOrEqual(6);
    for (const hub of hubs) {
      expect(SRC.get(hub)!).toMatch(/<LinkPending \/>/);
    }
  });

  it('待ち表示は必ず Link の内側にある（外に置くと常に非表示になる）', () => {
    for (const [path, src] of SRC) {
      if (!src.includes('<LinkPending />') || path === PENDING) continue;
      for (const m of src.matchAll(/<LinkPending \/>/g)) {
        const before = src.slice(0, m.index);
        const openIdx = before.lastIndexOf('<Link');
        const closeIdx = before.lastIndexOf('</Link>');
        expect(openIdx, `${path} の LinkPending が Link の外にある`).toBeGreaterThan(closeIdx);
      }
    }
  });
});
