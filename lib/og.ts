/**
 * OG 画像の参照（auto-backlog F5）。
 *
 * 画像は `public/og/*.png` に**静的生成してコミット**してある（scripts/generate-og.mjs）。
 * ビルド時にも実行時にも生成しないので、CI に日本語フォントも画像生成ライブラリも要らない。
 *
 * ツールごとに1枚、それ以外は default.png。og:image は絶対 URL が必要なので
 * SITE.url を前置する（SNS のクローラは相対パスを解決しない）。
 */
import { SITE } from './site';
import { liveTools } from './tools-registry';

/** OG 画像の標準サイズ（Twitter/X の summary_large_image・Facebook 推奨）。 */
export const OG_IMAGE_SIZE = { width: 1200, height: 630 } as const;

/** 生成済み画像がある slug の集合（default を含む）。 */
export function ogImageSlugs(): string[] {
  return ['default', ...liveTools().map((t) => t.slug)];
}

export interface OgImageDescriptor {
  url: string;
  width: number;
  height: number;
  alt: string;
}

/**
 * OG 画像の記述子を返す。
 *
 * @param slug ツールの slug。未指定・未生成なら default.png を返す
 *             （画像の無い og:image を出すより、共通画像のほうが SNS 上で成立する）
 */
export function ogImage(slug?: string): OgImageDescriptor {
  const name = slug && liveTools().some((t) => t.slug === slug) ? slug : 'default';
  return {
    url: `${SITE.url}/og/${name}.png`,
    ...OG_IMAGE_SIZE,
    alt: SITE.name,
  };
}
