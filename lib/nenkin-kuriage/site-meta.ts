/**
 * 年金 繰上げ・繰下げツール（nenkin-kuriage）の記事系メタ情報。
 * `url` はモノレポ共通サイト（lib/site.ts）配下の /nenkin-kuriage をルートとする。
 */
import { SITE } from '@/lib/site';

export const SITE_META = {
  name: '年金 繰上げ・繰下げ 損益分岐シミュレーター',
  url: `${SITE.url}/nenkin-kuriage`,
  description:
    '受給開始年齢ごとの年金月額・累計と、繰上げ・繰下げの損益分岐となる年齢を試算するシミュレーター。',
  lastUpdated: '2026-07-24',
  appliedLawDate: '令和7年（2025年）時点',
} as const;
