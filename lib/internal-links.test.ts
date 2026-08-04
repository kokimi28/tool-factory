/**
 * 内部リンク整合の点検（QC13・記事の内部リンクに回帰なし）。
 *
 * 記事本文・ハブページにハードコードされた内部リンク（href="/xxx" など）の先頭セグメントが、
 * すべて「公開中ツール slug」または「既知の静的ルート（/articles /about /privacy /disclosure）」に
 * 解決することを CI で固定する。ツールの slug 変更・削除やタイポで内部リンクが静かに壊れたら
 * ここで赤くなる（＝既存記事の内部リンクに回帰なしを担保）。
 *
 * 動的セグメント（`/${slug}` のようにテンプレート式で始まるもの）は generateStaticParams 側で
 * 検証済みのため対象外。ここでは literal な先頭セグメントのみを検査する。
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, it, expect } from "vitest";
import { isKnownInternalRoot } from "./links";

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));

/** app/ 配下の .tsx を再帰列挙。 */
function collectTsx(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...collectTsx(p));
    else if (name.endsWith(".tsx")) out.push(p);
  }
  return out;
}

// href="/seg..." または href={`/seg...`}（seg は英小文字始まりの literal）を拾う。
// `/${...}` のような動的先頭は `/` の次が `$` で英小文字でないため自然に除外される。
const HREF_RE = /href=(?:"|\{`)\/([a-z][a-z0-9-]*)/g;

describe("QC13 内部リンク整合（ハードコード href の先頭セグメント）", () => {
  const files = collectTsx(join(repoRoot, "app"));

  it("走査対象のページが存在する", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const file of files) {
    const src = readFileSync(file, "utf8");
    const segments = new Set<string>();
    let m: RegExpExecArray | null;
    while ((m = HREF_RE.exec(src)) !== null) segments.add(m[1]);
    if (segments.size === 0) continue;

    const rel = file.slice(repoRoot.length + 1);
    it(`${rel}: 内部リンクの先頭セグメントが全て有効`, () => {
      for (const seg of segments) {
        expect(
          isKnownInternalRoot(seg),
          `未知の内部リンク先: /${seg}（${rel}）`,
        ).toBe(true);
      }
    });
  }
});
