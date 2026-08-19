/**
 * OG 画像（1200×630 PNG）を静的に生成する（auto-backlog F5）。
 *
 * 生成物は public/og/*.png としてコミットする。**ビルド時にも実行時にも走らない**ので、
 * CI にフォントも画像生成ライブラリも増やさない（`next/og` を使うと Satori が日本語
 * フォントを必要とし、ビルドにフォントの同梱かネットワーク取得が要る。静的生成なら
 * その依存ごと消せる ＝ backlog が「静的」と指定している理由）。
 *
 * 再生成:
 *   npm i -D playwright   # または npx playwright
 *   node scripts/generate-og.mjs
 *
 * ツール名・説明は lib/tools-registry.ts を唯一の正として読む。ツールを増やしたら
 * このスクリプトを再実行するだけで画像が揃う（テストが枚数と対応を検査する）。
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const outDir = join(root, 'public', 'og');

const { liveTools } = await import(join(root, 'lib', 'tools-registry.ts'));
const { SITE } = await import(join(root, 'lib', 'site.ts'));

/** 1枚ぶんの HTML。日本語はシステムの IPAGothic 等で描画する。 */
function card({ eyebrow, title, description, foot }) {
  const esc = (s) =>
    String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { width:1200px; height:630px; display:flex;
      font-family:"IPAGothic","Noto Sans CJK JP","Noto Sans JP",sans-serif; }
    .bar { width:16px; background:linear-gradient(180deg,#2563eb,#1e40af); }
    .body { flex:1; padding:72px 80px; display:flex; flex-direction:column;
      justify-content:center; background:#ffffff; }
    .eyebrow { font-size:30px; color:#2563eb; font-weight:700; letter-spacing:.04em; }
    .title { margin-top:24px; font-size:60px; line-height:1.25; font-weight:700; color:#0f172a; }
    .desc { margin-top:28px; font-size:30px; line-height:1.6; color:#475569; }
    .foot { margin-top:auto; padding-top:36px; font-size:24px; color:#94a3b8;
      border-top:1px solid #e2e8f0; }
  </style></head><body>
    <div class="bar"></div>
    <div class="body">
      <div class="eyebrow">${esc(eyebrow)}</div>
      <div class="title">${esc(title)}</div>
      <div class="desc">${esc(description)}</div>
      <div class="foot">${esc(foot)}</div>
    </div>
  </body></html>`;
}

/** フッターに出すホスト名（どのサイトの画像か一目で分かるように）。 */
const host = SITE.url.replace(/^https?:\/\//, '');

const targets = [
  {
    file: 'default.png',
    eyebrow: '税金の「いくら？」に即答',
    title: SITE.name,
    description: '退職金・iDeCo・年収の手取りなど、単機能で即答する計算ツール集。',
    foot: host,
  },
  ...liveTools().map((t) => ({
    file: `${t.slug}.png`,
    eyebrow: SITE.name,
    title: t.name,
    // OG は一覧性が命なので、長い説明は最初の一文だけ使う
    description: `${String(t.description).split('。')[0]}。`,
    foot: `${host}/${t.slug}`,
  })),
];

await mkdir(outDir, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
for (const t of targets) {
  await page.setContent(card(t), { waitUntil: 'load' });
  const png = await page.screenshot({ type: 'png' });
  await writeFile(join(outDir, t.file), png);
  console.log(`generated public/og/${t.file} (${png.length} bytes)`);
}
await browser.close();
