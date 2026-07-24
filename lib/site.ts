/**
 * サイト共通メタ（Tool Factory モノレポの単一の正）
 *
 * 税ツールを1アプリ・1 Vercel プロジェクトに集約した「器」の共通設定。
 * 個別ツールのメタ（名前・説明）は lib/tools-registry.ts が持つ。
 * 正本: dev-env docs/dev-env/tool-factory-consolidation.md
 */

export const SITE = {
  name: "税金計算ツールファクトリー",
  short: "税ツール",
  // 公開 URL。Vercel 接続時（👤・1回のみ）に本番ドメインへ差し替える。
  // 既定は環境変数、無ければ本番 vercel.app（プレビューでも安全に絶対URLを生成）。
  url:
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
    "https://tool-factory.vercel.app",
  description:
    "退職金・iDeCo・年収の手取りなど、税金の「いくら？」に単機能で即答する計算ツール集。すべて同じ場所で、関連ツールへワンタップ。",
  // 法令確認日（全ツール共通の基準日。ツール別の最終確認は各 calculations.ts のコメントが正）。
  lawCheckedAt: "2026-07-24",
} as const;
