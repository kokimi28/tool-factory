/**
 * 住宅ローン控除ツール（jutaku-loan）の記事系メタ情報。
 *
 * ツール本体のメタは app/(tools)/jutaku-loan/page.tsx がインラインで持つ。
 * 本ファイルは記事（articles.ts と articles ルート）が参照する共通メタで、
 * `url` はモノレポ共通サイト（lib/site.ts）配下の /jutaku-loan をルートとする。
 */
import { SITE } from '@/lib/site';

export const SITE_META = {
  name: '住宅ローン控除シミュレーター',
  url: `${SITE.url}/jutaku-loan`,
  description:
    '借入額・年収・住宅性能から、住宅ローン控除（0.7%・新築13年/中古10年）の各年と総額の控除見込みを試算するシミュレーター。',
  /** 法令・料率の最終確認日（calculations.ts と同期） */
  lastUpdated: '2026-07-24',
  /** 適用基準（令和6年入居基準） */
  appliedLawDate: '令和6年（2024年）入居基準',
} as const;
