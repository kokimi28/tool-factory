/**
 * 年収の壁ツール（nenshu-kabe）の記事系メタ情報。
 * `url` はモノレポ共通サイト（lib/site.ts）配下の /nenshu-kabe をルートとする。
 */
import { SITE } from '@/lib/site';

export const SITE_META = {
  name: '年収の壁 手取り逆転シミュレーター',
  url: `${SITE.url}/nenshu-kabe`,
  description:
    '103・106・130・150万円の「年収の壁」ごとに、超えた場合の手取りの逆転と回復ラインを試算するシミュレーター。',
  lastUpdated: '2026-08-16',
  appliedLawDate: '令和7年（2025年）分の税制＋令和8年度の社会保険料率',
} as const;
