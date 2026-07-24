/**
 * 退職金ツール（taishokukin）のメタ情報
 *
 * tool-factory 移行時に retirement-tax-sim から移送。`url` はモノレポの
 * 共通サイト（lib/site.ts）配下の /taishokukin をルートとする（記事・canonical・
 * JSON-LD の絶対 URL はここから自動生成される）。
 */
import { SITE } from '@/lib/site';

export const SITE_META = {
  /** サイト名 */
  name: '退職金課税シミュレーター',
  /** このツールの公開ルート（モノレポ共通ドメイン配下の /taishokukin） */
  url: `${SITE.url}/taishokukin`,
  /** サイト概要 */
  description:
    '退職金額と勤続年数から、退職所得控除・所得税・住民税・手取り額をかんたんに計算するシミュレーター。',
  /** 最終更新日（法令確認日） */
  lastUpdated: '2026-05-19',
  /** 適用法令日 */
  appliedLawDate: '令和7年4月1日',
  /** 公開日 */
  publishedDate: '2026-05-17',
} as const;

/**
 * 運営者情報
 *
 * TODO: 公開前に以下の値を実値で埋める。
 *   - operator.name      → 運営者の本名
 *   - operator.email     → 連絡先メールアドレス
 *
 * 注：このファイルを編集するだけで、特商法ベース表記・プライバシーポリシー
 * 両ページに同期的に反映される。
 */
export const OPERATOR_INFO = {
  /** 運営者氏名 */
  name: '三浦 航輝',
  /** 連絡先メールアドレス */
  email: 'kokimi2890@gmail.com',
  /** 所在地（個人運営は都道府県のみで可、請求があれば開示する形が一般的） */
  address: '請求があった場合、遅滞なく開示します',
  /** 電話番号（個人運営は省略可、請求があれば開示する形が一般的） */
  phone: '請求があった場合、遅滞なく開示します',
} as const;
