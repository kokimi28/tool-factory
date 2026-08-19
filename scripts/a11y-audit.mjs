/**
 * axe-core による a11y 監査（auto-backlog F7）。
 *
 * CI では実行しない（ブラウザと axe-core が要るため。F5 と同じく CI の依存を増やさない方針）。
 * 実行手順:
 *   npm run build
 *   npx next start -p 3122 &
 *   npm i --no-save axe-core
 *   node scripts/a11y-audit.mjs            # 既定のポート 3122
 *   node scripts/a11y-audit.mjs 3000       # ポートを変える場合
 *
 * 出力: ルールごとに違反数と該当箇所。違反があれば終了コード1。
 *
 * 構造的な退行（ランドマーク・ラベル・低コントラストのクラス）は
 * lib/a11y.test.ts が依存ゼロで CI から見ているので、こちらは通し確認用。
 */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const PORT = process.argv[2] ?? '3122';
const BASE = `http://localhost:${PORT}`;
const PATHS = [
  '/', '/tedori', '/nenshu-kabe', '/ideco', '/furusato', '/jutaku-loan',
  '/taishokukin', '/nenkin-kuriage', '/articles', '/about', '/privacy', '/disclosure',
  '/tedori/articles', '/tedori/articles/tedori-shikumi',
  '/nenshu-kabe/articles/nenshu-kabe-103',
  '/this-path-does-not-exist',
];

const axe = readFileSync(new URL('../node_modules/axe-core/axe.min.js', import.meta.url), 'utf8');
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
});

const found = new Map();
for (const path of PATHS) {
  const page = await browser.newPage();
  await page.goto(BASE + path, { waitUntil: 'networkidle' });
  await page.addScriptTag({ content: axe });
  const result = await page.evaluate(async () =>
    window.axe.run(document, { resultTypes: ['violations'] }),
  );
  for (const v of result.violations) {
    if (!found.has(v.id)) found.set(v.id, { impact: v.impact, help: v.help, hits: [] });
    for (const node of v.nodes) {
      found.get(v.id).hits.push(`${path} ${node.target.join(' ')}`);
    }
  }
  console.log(
    `${path} -> ${result.violations.length === 0 ? 'clean' : result.violations.map((v) => `${v.id}x${v.nodes.length}`).join(', ')}`,
  );
  await page.close();
}
await browser.close();

if (found.size > 0) {
  for (const [id, v] of found) {
    console.log(`\n### ${id} [${v.impact}] ${v.help}`);
    for (const hit of v.hits.slice(0, 10)) console.log('  -', hit);
    if (v.hits.length > 10) console.log(`  ... 他 ${v.hits.length - 10} 箇所`);
  }
}
console.log(`\n違反ルール数: ${found.size}`);
process.exit(found.size === 0 ? 0 : 1);
