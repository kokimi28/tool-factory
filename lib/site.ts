/**
 * サイト共通メタ（Tool Factory モノレポの単一の正）
 *
 * 税ツールを1アプリ・1 Vercel プロジェクトに集約した「器」の共通設定。
 * 個別ツールのメタ（名前・説明）は lib/tools-registry.ts が持つ。
 * 正本: dev-env docs/dev-env/tool-factory-consolidation.md
 */

// 本番の既定 URL（canonical / sitemap / robots / JSON-LD / metadataBase の
// 絶対 URL 基点）。独自ドメイン取得時（👤）はここ 1 行を差し替える or
// NEXT_PUBLIC_SITE_URL を設定するだけでサイト全体に反映される。
//
// 満たすべき条件は 2 つあり、Q-SEO #9 は前者だけを見て後者を落とした:
//   1. 自分が所有しているホストであること（未所有の `tool-factory.vercel.app` は
//      他者占有の疑いがあり、canonical が他人のサイトを向く）
//   2. **そのホストが indexable であること**
//
// 2 を外すと「正しい自分のサイトを指した canonical が、検索から除外される」。
// Vercel は**チームスコープのデプロイ URL**（`<project>-<team>-projects-<hash>`
// の形）に `x-robots-tag: noindex` を付けて返すため、そこを canonical にすると
// 全ページが検索対象から外れる。本番エイリアス（チーム名を含まない形）には
// 付かない。実測 2026-08-23 / 再測 2026-08-24:
//   tool-factory-kokis-projects-740a782c.vercel.app → 200 + x-robots-tag: noindex
//   tool-factory-five.vercel.app                    → 200（ヘッダ無し＝indexable）
// どちらも title「税金計算ツールファクトリー」＝同一の自サイトであることを
// 内容照合まで確認済み（`*.vercel.app` は全ユーザー共有の名前空間なので
// ステータスコードだけでは占有判定にならない）。
const DEFAULT_SITE_URL = "https://tool-factory-five.vercel.app";

export const SITE = {
  name: "税金計算ツールファクトリー",
  short: "税ツール",
  // 公開 URL。既定は環境変数、無ければ上の実在する本番エイリアス
  // （プレビューでも安全に絶対 URL を生成）。
  url: process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? DEFAULT_SITE_URL,
  description:
    "退職金・iDeCo・年収の手取りなど、税金の「いくら？」に単機能で即答する計算ツール集。すべて同じ場所で、関連ツールへワンタップ。",
  // 法令確認日（全ツール共通の基準日。ツール別の最終確認は各 calculations.ts のコメントが正）。
  lawCheckedAt: "2026-07-24",
} as const;
