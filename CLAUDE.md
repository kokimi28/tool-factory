# CLAUDE.md — tool-factory

税ツール（Tool Factory ライン）を集約する**単一 Next.js アプリ・単一 Vercel プロジェクト**のモノレポ。退職金・iDeCo・年収の手取りなどの計算ツールを「1つの器」に横展開し、**ツール追加時の設定・付与作業をゼロ**にする。正本: dev-env `docs/dev-env/tool-factory-consolidation.md`（B分散→B集約への転換）。

## 1. 構成

```
app/
  (tools)/                 ルートグループ（ツール共通レイアウト）
    <slug>/page.tsx        各ツールのページ（/taishokukin, /ideco, /tedori, /furusato …）
    <slug>/articles/…      各ツールの記事（トピッククラスタを維持）
  page.tsx                 トップ＝ツール一覧ハブ（tools-registry から自動生成）
  about / privacy / disclosure   共通の静的ページ
  sitemap.ts robots.ts     全ツール・全記事を1本に集約
lib/
  <slug>/calculations.ts + .test.ts   ツール別の計算（純関数＋テスト＝価値と品質ゲート）
  site.ts                  サイト共通メタ
  tools-registry.ts        全ツールの登録簿（ハブ・sitemap・相互リンクの起点）
components/
  RelatedTools.tsx SiteFooter.tsx …   共通コンポーネント（相互リンク＝連結の実体）
```

## 2. 使用コマンド

| 目的 | コマンド |
| --- | --- |
| 開発サーバー | `npm run dev`（ポート3000） |
| 型チェック | `npx tsc --noEmit` |
| ユニットテスト | `npm test`（Vitest） |
| 本番ビルド確認 | `npm run build` |

実装後は **型チェック → テスト → ビルド** の3点を通してから完了とする（CI `.github/workflows/ci.yml` の `check` も同じ3点）。

## 3. 新しいツールの追加（設定・付与ゼロ）

1. `app/(tools)/<slug>/page.tsx` と `lib/<slug>/calculations.ts`（＋`.test.ts`）を追加。
2. `lib/tools-registry.ts` の `TOOLS` に1行足し、構築できたら `status` を `'live'` にする。
   → トップのハブ・sitemap・フッター・関連ツール（`RelatedTools`）に**自動反映**。
3. `check` green で自走マージ → 自動デプロイ。**Vercel import 不要・env 不要・topic 不要**。
4. 新税ツールは dev-env `/idea-to-spec` のゲート（重複・占有・命名）を通してからこの器に入れる。

## 4. 規約

- **計算ロジックは `lib/<slug>/` の純粋関数**として実装し Vitest でテストする（UI に埋め込まない）。記事の worked example の金額は必ず対応する計算関数で再現できる値のみ使い、`*.test.ts` に固定する（誤値は CI で落ちる）。
- 既存3ツール（retirement / ideco / tedori）の移行時は**ロジックとテストを無改変で移送**する（数字の正しさ＝金経路を壊さない。既存テスト green が回帰ガード）。
- `main` への直接 push はしない（PR 経由・`check` green を確認）。
- secrets・個人情報をコード・コミット・Issue・PR に書かない。公開値（GA4 ID 等）はモノプロジェクトに1回だけ設定。

## 5. 収益化・課金（👤 専任・STOP）

- ASP 案件 URL の差し込み・CTA の有効化など収益が発生しうる導線、Vercel Pro 移行・独自ドメイン購入・課金は**オーナー専任の STOP 対象**。エージェントは単独で実行しない。
- 正本: dev-env `docs/dev-env/tool-factory-consolidation.md` / `portfolio-integration.md`。

## 6. リモート/クラウドセッション運用（claude.ai/code・スマホ発）

`CLAUDE_CODE_REMOTE=true` のとき、claude.ai/code のクラウドコンテナ（Linux）で実行されている。SessionStart hook（`.claude/hooks/session-start.mjs`）が依存導入と環境診断（preflight）を行い、結果をセッション冒頭に出力する。この環境ではローカルの個人設定（`~/.claude/`・ユーザー MCP）は届かない前提で、以下の縮退規約に従う。

- **止まらない**: 検証手段が無いことを理由に作業を中断しない。実装 → 実行可能な検証をすべて実行 → push → draft PR 作成 → CI green まで追走、が完了の定義。
- **検証はできるものを全部**: `npx tsc --noEmit` → `npm test` → `npm run build` の3点は必ず実行する。実行できなかった検証は PR 本文の「未検証項目」に列挙する（黙って省略しない）。
- **UI 実機確認の代替**: Playwright MCP が無い環境では、開発サーバーを起動して `node scripts/verify-ui-remote.mjs http://localhost:3000/ <他URL...>` を実行し、スクリーンショット（`.claude/tmp/ui-*.png`）を Read で視覚確認する（同梱 Chromium 使用・依存追加なし）。
- **secrets 非接触**: このリポにサーバー秘密は無い（公開値のみ）。それでも `.env` 系ファイルの読み書きはしない（値の要求・推測・生成をしない）。
- **外部疎通の限界**: allowlist 外（`*.vercel.app` 等）への疎通確認は不可（HTTP 000）。デプロイ後確認は CI とオーナーに委ねる。
- **スマホからのキック**: 起票・依頼の定型は dev-env `docs/prompts/mobile-kick.md` を使う（完了条件込みの1メッセージで渡す）。
