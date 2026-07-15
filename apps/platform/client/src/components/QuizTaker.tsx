import { useState } from "react";
import { Check, X } from "lucide-react";
import { trpc } from "../lib/trpc";
import { Button, Card, Spinner, cn } from "./ui";

type Review = {
  prompt: string;
  options: string[];
  yourIndex: number;
  correctIndex: number;
};

export function QuizTaker({ quizId, onClose }: { quizId: number; onClose: () => void }) {
  const quiz = trpc.quizzes.take.useQuery({ quizId });
  const utils = trpc.useUtils();
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [result, setResult] = useState<{
    score: number;
    correctCount: number;
    totalCount: number;
    review: Review[];
  } | null>(null);
  const submit = trpc.quizzes.submit.useMutation({
    onSuccess: (r) => {
      setResult(r);
      utils.quizzes.mine.invalidate();
    },
  });

  if (quiz.isLoading)
    return (
      <Card className="p-6">
        <Spinner label="Loading quiz…" />
      </Card>
    );
  if (!quiz.data) return null;
  const qs = quiz.data.questions;

  if (result) {
    return (
      <Card className="p-6">
        {/* Score header */}
        <div className="mb-6 text-center">
          <div className="text-5xl font-bold text-navy-900">{result.score}%</div>
          <p className="mt-2 text-ink/60">
            {result.correctCount} of {result.totalCount} correct
          </p>
        </div>

        {/* Answer review — turn the score into actual learning */}
        <div className="space-y-4">
          {result.review.map((r, qi) => {
            const gotIt = r.yourIndex === r.correctIndex;
            return (
              <div
                key={qi}
                className={cn(
                  "rounded-xl border p-4",
                  gotIt ? "border-emerald-200 bg-emerald-50/50" : "border-red-200 bg-red-50/40",
                )}
              >
                <div className="flex items-start gap-2">
                  <span
                    className={cn(
                      "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-white",
                      gotIt ? "bg-emerald-500" : "bg-red-500",
                    )}
                  >
                    {gotIt ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                  </span>
                  <p className="font-medium text-navy-900">
                    {qi + 1}. {r.prompt}
                  </p>
                </div>
                <div className="mt-3 space-y-1.5 pl-7">
                  {r.options.map((o, oi) => {
                    const isCorrect = oi === r.correctIndex;
                    const isYours = oi === r.yourIndex;
                    return (
                      <div
                        key={oi}
                        className={cn(
                          "flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm",
                          isCorrect
                            ? "border-emerald-300 bg-emerald-100/60 font-medium text-emerald-900"
                            : isYours
                              ? "border-red-300 bg-red-100/50 text-red-900"
                              : "border-transparent text-ink/50",
                        )}
                      >
                        <span>{o}</span>
                        <span className="shrink-0 text-xs font-semibold">
                          {isCorrect ? "Correct answer" : isYours ? "Your answer" : ""}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <Button className="mt-6 w-full" onClick={onClose}>
          Done
        </Button>
      </Card>
    );
  }

  return (
    <Card className="space-y-4 p-6">
      <h3 className="text-lg font-semibold text-navy-900">{quiz.data.title}</h3>
      {qs.map((q, qi) => (
        <div key={q.id}>
          <p className="font-medium text-navy-900">
            {qi + 1}. {q.prompt}
          </p>
          <div className="mt-2 space-y-1.5">
            {q.options.map((o, oi) => (
              <label
                key={oi}
                className="flex items-center gap-2 rounded-lg border border-gray-100 px-3 py-2 transition hover:border-navy/30"
              >
                <input
                  type="radio"
                  name={`q-${q.id}`}
                  checked={answers[qi] === oi}
                  onChange={() => setAnswers((a) => ({ ...a, [qi]: oi }))}
                  className="accent-[#0a2540]"
                />
                <span className="text-sm">{o}</span>
              </label>
            ))}
          </div>
        </div>
      ))}
      <div className="flex gap-2">
        <Button
          onClick={() => submit.mutate({ quizId, answers: qs.map((_, i) => answers[i] ?? -1) })}
          disabled={submit.isPending}
        >
          Submit
        </Button>
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </Card>
  );
}
