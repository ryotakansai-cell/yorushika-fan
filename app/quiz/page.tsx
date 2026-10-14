import type { Metadata } from "next";
import Link from "next/link";
import { SpotQuiz } from "@/components/SpotQuiz";
import { getQuizQuestions } from "@/lib/map";

export const metadata: Metadata = {
  alternates: { canonical: "/quiz" },
  title: "聖地クイズ",
  description:
    "ヨルシカのMVの場面やジャケット写真を見て、その場所を地図で当てるクイズ。全5問、正解に近いほど高得点。",
};

// 聖地クイズ。問題は聖地巡礼マップのデータ（scenes.json）から作るので、マップに場所を足すと問題も増える
export default function QuizPage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-10">
      <h1 className="font-serif text-2xl text-ink">聖地クイズ</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        この場面はどこ？
        MVの場面やジャケット写真から、ヨルシカの聖地を地図で当ててください。
        答え合わせのあとは、
        <Link href="/map" className="text-ink transition hover:text-accent">
          聖地巡礼マップ
        </Link>
        でMVの場面と今の景色を並べて見られます。
      </p>

      <div className="mt-6">
        <SpotQuiz questions={getQuizQuestions()} />
      </div>
    </main>
  );
}
