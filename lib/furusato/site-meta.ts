/**
 * ふるさと納税ツール（furusato）の記事系メタ情報。
 *
 * ツール本体のメタは app/(tools)/furusato/page.tsx がインラインで持つ。
 * 本ファイルは記事（articles.ts と articles ルート）が参照する共通メタで、
 * `url` はモノレポ共通サイト（lib/site.ts）配下の /furusato をルートとする
 * （記事・canonical・JSON-LD の絶対 URL はここから自動生成される）。
 */
import { SITE } from '@/lib/site';

export const SITE_META = {
  /** サイト名（記事の publisher / author 表記に使う） */
  name: 'ふるさと納税 限度額シミュレーター',
  /** このツールの公開ルート（モノレポ共通ドメイン配下の /furusato） */
  url: `${SITE.url}/furusato`,
  /** サイト概要 */
  description:
    '年収や課税所得から、自己負担2,000円で済むふるさと納税の控除上限額の目安を計算するシミュレーター。',
  /** 最終更新日（法令・料率の最終確認日。calculations.ts と同期） */
  lastUpdated: '2026-07-24',
  /** 適用法令の基準日（本文の免責表記に使う） */
  appliedLawDate: '令和7年（2025年）分',
} as const;
