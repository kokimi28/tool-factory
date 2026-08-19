/**
 * OG 画像の網羅と参照（auto-backlog F5）。
 *
 * 画像は静的生成してコミットする方式なので、**ツールを増やしたときに画像を作り忘れる**のが
 * いちばん起きやすい事故。ここでレジストリと public/og/ の実ファイルを突き合わせて CI で止める。
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { OG_IMAGE_SIZE, ogImage, ogImageSlugs } from './og';
import { SITE } from './site';
import { liveTools } from './tools-registry';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const ogDir = join(repoRoot, 'public', 'og');

/** PNG の IHDR から幅・高さを読む（画像ライブラリを足さずにサイズを検査する）。 */
function pngSize(path: string): { width: number; height: number } {
  const buf = readFileSync(path);
  expect(buf.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a'); // PNG シグネチャ
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

describe('OG 画像が全ツールぶん存在する', () => {
  it('レジストリの live ツール＋default の枚数だけある', () => {
    expect(ogImageSlugs()).toEqual(['default', ...liveTools().map((t) => t.slug)]);
  });

  it('各 slug の PNG が実在し、1200×630 である', () => {
    for (const slug of ogImageSlugs()) {
      const path = join(ogDir, `${slug}.png`);
      expect(existsSync(path), `public/og/${slug}.png が無い（scripts/generate-og.mjs を実行）`).toBe(true);
      expect(pngSize(path)).toEqual({ width: OG_IMAGE_SIZE.width, height: OG_IMAGE_SIZE.height });
    }
  });

  it('画像は SNS のクローラが解決できる絶対 URL で参照される', () => {
    for (const t of liveTools()) {
      const img = ogImage(t.slug);
      expect(img.url).toBe(`${SITE.url}/og/${t.slug}.png`);
      expect(img.url.startsWith('https://')).toBe(true);
    }
  });

  it('未知の slug は default にフォールバックする（画像なしの og:image を出さない）', () => {
    expect(ogImage('does-not-exist').url).toBe(`${SITE.url}/og/default.png`);
    expect(ogImage().url).toBe(`${SITE.url}/og/default.png`);
  });

  it('1枚あたりのサイズが大きすぎない（SNS の取得が失敗しない範囲）', () => {
    for (const slug of ogImageSlugs()) {
      const bytes = readFileSync(join(ogDir, `${slug}.png`)).length;
      expect(bytes, `${slug}.png が大きすぎる`).toBeLessThan(300_000);
    }
  });
});

describe('各ツールのページが自分の OG 画像を指している', () => {
  it('openGraph.images と twitter.images の両方が自分の画像を指している', () => {
    // どちらか一方だけを見る検査では、片方を消しても通ってしまう（変異で実証済み）。
    // og:image と twitter:image は別のメタなので、両方を個別に固定する。
    for (const t of liveTools()) {
      const src = readFileSync(join(repoRoot, 'app', '(tools)', t.slug, 'page.tsx'), 'utf-8');
      const q = `['"]${t.slug}['"]`;
      expect(src, `${t.slug}: openGraph.images が自分の画像を指していない`).toMatch(
        new RegExp(`images:\\s*\\[ogImage\\(${q}\\)\\]`),
      );
      expect(src, `${t.slug}: twitter.images が自分の画像を指していない`).toMatch(
        new RegExp(`images:\\s*\\[ogImage\\(${q}\\)\\.url\\]`),
      );
    }
  });

  it('twitter は summary_large_image（1200×630 を活かすカード種別）', () => {
    for (const t of liveTools()) {
      const src = readFileSync(join(repoRoot, 'app', '(tools)', t.slug, 'page.tsx'), 'utf-8');
      expect(src).toContain('summary_large_image');
      expect(src).not.toMatch(/card:\s*['"]summary['"]/);
    }
  });
});
