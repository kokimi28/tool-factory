import type { Metadata } from "next";
import Script from "next/script";
import { Geist, Geist_Mono } from "next/font/google";
import SiteFooter from "@/components/SiteFooter";
import { SITE } from "@/lib/site";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: SITE.name,
    template: `%s | ${SITE.name}`,
  },
  description: SITE.description,
  robots: {
    index: true,
    follow: true,
  },
  // QC8: OGP / Twitter Card のサイト共通デフォルト。全ページ・全記事が継承し、
  // 個別ページ（記事など）が openGraph.title/description/url を上書きする。
  // 画像アセットは未用意のため card は summary（画像なしでも成立）。取得後に
  // openGraph.images / twitter.card=summary_large_image をここ1か所に足せば全ページに反映される。
  openGraph: {
    type: "website",
    siteName: SITE.name,
    locale: "ja_JP",
    url: SITE.url,
    title: SITE.name,
    description: SITE.description,
  },
  twitter: {
    card: "summary",
    title: SITE.name,
    description: SITE.description,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Google Analytics 4 Measurement ID（モノプロジェクトに1回だけ設定）。
  // 未設定なら GA4 タグを出力しない（開発・プレビューで安全）。
  const gaId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

  return (
    <html
      lang="ja"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        {/* QC14: GA を使うときだけ第三者オリジンへ preconnect し初回接続を短縮（Lighthouse 推奨）。 */}
        {gaId && (
          <link rel="preconnect" href="https://www.googletagmanager.com" />
        )}
      </head>
      <body className="min-h-full flex flex-col">
        <div className="flex-1">{children}</div>
        <SiteFooter />
        {/* QC14: GA タグは next/script の afterInteractive で読み込み、初期描画を妨げない
            （従来の <script async> はレンダーブロッキングとして Lighthouse に計上されうる）。 */}
        {gaId && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
              strategy="afterInteractive"
            />
            <Script id="ga-init" strategy="afterInteractive">
              {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${gaId}', { anonymize_ip: true });`}
            </Script>
          </>
        )}
      </body>
    </html>
  );
}
