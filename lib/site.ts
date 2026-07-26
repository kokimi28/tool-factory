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
// 注意: 未所有の `tool-factory.vercel.app`（他者占有の疑い）を指すと canonical が
// 他人ドメインを向き SEO 上有害なため、実在する本番エイリアスを既定にする。
const DEFAULT_SITE_URL =
  "https://tool-factory-kokis-projects-740a782c.vercel.app";

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
