# 目的 / Why

<!-- 何のための変更か1〜2文で。関連 Issue があればリンク -->

Closes #

## 変更点 / What

-

## 検証 / How verified

- [ ] `npx tsc --noEmit`（型チェック）green
- [ ] `npm test`（Vitest）green
- [ ] `npm run build` 成功
- [ ] UI 変更あり → Playwright MCP（ローカル）または `node scripts/verify-ui-remote.mjs`（リモート）で該当ページを実機確認した / UI 変更なし

## 未検証項目 / Not verified

<!-- 実行環境の制約（リモートセッション: secrets 不在・外部疎通遮断・MCP 不在等）で実行できなかった検証を列挙する。全部実行できたら「なし」と書く -->

- なし

## スコープ確認 / Scope

- [ ] 計算ロジックは `lib/<slug>/` の純関数＋テスト（UI に埋め込んでいない）
- [ ] 収益導線（ASP 案件 URL・CTA の有効化）に触れていない（👤 専任・STOP 対象）
- [ ] `lib/tools-registry.ts` の更新の要否を確認した（ツール追加・status 変更時）
