import type { Metadata } from "next";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "免責事項",
  description: `${SITE.name}の免責事項。`,
  alternates: { canonical: "/disclosure" },
};

export default function DisclosurePage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 space-y-4">
      <h1 className="text-2xl font-bold">免責事項</h1>
      <p className="text-black/70">
        本サイトの計算結果は概算・参考値であり、正確性・完全性を保証するもの
        ではありません。法令改正・個別事情により実際の税額は変わります。
      </p>
      <p className="text-black/70">
        本サイトの情報を利用して生じたいかなる損害についても、運営者は責任を
        負いかねます。重要な判断は必ず税理士等の専門家にご相談ください。
      </p>
    </main>
  );
}
