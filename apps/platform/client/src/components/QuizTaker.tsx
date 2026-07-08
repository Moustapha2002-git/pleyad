import { useState } from "react";
import { trpc } from "../lib/trpc";
import { Button, Card, Spinner } from "./ui";

export function QuizTaker({ quizId, onClose }: { quizId: number; onClose: () => void }) {
  const quiz = trpc.quizzes.take.useQuery({ quizId });
  const utils = trpc.useUtils();
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [result, setResult] = useState<{
    score: number;
    correctCount: number;
    totalCount: number;
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
      <Card className="p-8 text-center">
        <div className="text-5xl font-bold text-navy-900">{result.score}%</div>
        <p className="mt-2 text-ink/60">
          {result.correctCount} of {result.totalCount} correct
        </p>
        <Button className="mt-5" onClick={onClose}>
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
