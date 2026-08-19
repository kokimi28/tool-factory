import type { Metadata } from "next";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "このサイトについて",
  description: `${SITE.name}について。税金の「いくら？」に単機能で即答する計算ツール集です。`,
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 space-y-4">
      <h1 className="text-2xl font-bold">このサイトについて</h1>
      <p className="text-black/70">
        {SITE.name}は、退職金・iDeCo・年収の手取りなど、税金の「いくら？」に
        単機能で即答する計算ツール集です。すべてのツールは同じ場所にあり、
        関連するツールへワンタップで移動できます。
      </p>
      <p className="text-black/70">
        各ツールの計算は公開されている速算表・控除の仕組みに基づく概算です。
        法令確認日は {SITE.lawCheckedAt} 時点。実際の税額は個別の事情により
        変わるため、正確な金額は税理士・所轄税務署でご確認ください。
      </p>
    </div>
  );
}
