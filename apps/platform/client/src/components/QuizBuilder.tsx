import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { trpc } from "../lib/trpc";
import { useT } from "../lib/i18n";
import { Button, Card, TextInput } from "./ui";

type Q = { prompt: string; options: string[]; correctIndex: number };
const emptyQ = (): Q => ({ prompt: "", options: ["", ""], correctIndex: 0 });

export function QuizBuilder({
  learnerId,
  onCreated,
}: {
  learnerId: number;
  onCreated: () => void;
}) {
  const { t } = useT();
  const [title, setTitle] = useState("");
  const [questions, setQuestions] = useState<Q[]>([emptyQ()]);
  const create = trpc.quizzes.create.useMutation({
    onSuccess: () => {
      setTitle("");
      setQuestions([emptyQ()]);
      onCreated();
    },
  });

  const update = (qi: number, patch: Partial<Q>) =>
    setQuestions((qs) => qs.map((q, i) => (i === qi ? { ...q, ...patch } : q)));
  const setOption = (qi: number, oi: number, val: string) =>
    setQuestions((qs) =>
      qs.map((q, i) =>
        i === qi ? { ...q, options: q.options.map((o, j) => (j === oi ? val : o)) } : q,
      ),
    );
  const addOption = (qi: number) =>
    setQuestions((qs) =>
      qs.map((q, i) => (i === qi && q.options.length < 4 ? { ...q, options: [...q.options, ""] } : q)),
    );
  const removeQuestion = (qi: number) =>
    setQuestions((qs) => (qs.length > 1 ? qs.filter((_, i) => i !== qi) : qs));

  const submit = () => {
    const clean = questions
      .map((q) => {
        const kept: string[] = [];
        let correct = 0;
        q.options.forEach((o, i) => {
          const t = o.trim();
          if (t) {
            if (i === q.correctIndex) correct = kept.length;
            kept.push(t);
          }
        });
        return { prompt: q.prompt.trim(), options: kept, correctIndex: correct };
      })
      .filter((q) => q.prompt && q.options.length >= 2);
    if (!title.trim() || clean.length === 0) return;
    create.mutate({ learnerUserId: learnerId, title: title.trim(), questions: clean });
  };

  return (
    <div className="space-y-3">
      <TextInput
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={t("quizBuilder.titlePlaceholder")}
      />
      {questions.map((q, qi) => (
        <Card key={qi} className="space-y-2 p-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-ink/40">
              {t("quizBuilder.questionNum", { n: qi + 1 })}
            </span>
            <TextInput
              value={q.prompt}
              onChange={(e) => update(qi, { prompt: e.target.value })}
              placeholder={t("quizBuilder.questionPlaceholder")}
              className="flex-1"
            />
            {questions.length > 1 && (
              <button
                type="button"
                onClick={() => removeQuestion(qi)}
                className="rounded-lg border border-gray-200 p-2 text-ink/50 hover:bg-gray-50"
                aria-label={t("quizBuilder.removeQuestion")}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
          {q.options.map((o, oi) => (
            <label key={oi} className="flex items-center gap-2">
              <input
                type="radio"
                name={`correct-${qi}`}
                checked={q.correctIndex === oi}
                onChange={() => update(qi, { correctIndex: oi })}
                className="accent-[#0a2540]"
              />
              <TextInput
                value={o}
                onChange={(e) => setOption(qi, oi, e.target.value)}
                placeholder={t("quizBuilder.optionPlaceholder", { n: oi + 1 })}
                className="flex-1"
              />
            </label>
          ))}
          {q.options.length < 4 && (
            <button
              type="button"
              onClick={() => addOption(qi)}
              className="text-sm text-navy/60 transition hover:text-navy"
            >
              {t("quizBuilder.addOption")}
            </button>
          )}
          <p className="text-xs text-ink/40">{t("quizBuilder.hint")}</p>
        </Card>
      ))}
      <div className="flex gap-2">
        <Button
          type="button"
          variant="secondary"
          icon={Plus}
          onClick={() => setQuestions((qs) => [...qs, emptyQ()])}
        >
          {t("quizBuilder.addQuestion")}
        </Button>
        <Button type="button" onClick={submit} disabled={create.isPending}>
          {t("quizBuilder.createQuiz")}
        </Button>
      </div>
    </div>
  );
}
