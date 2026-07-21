import { useEffect, useRef, useState } from "react";
import { MessageSquare, Send } from "lucide-react";
import { trpc } from "../lib/trpc";
import { useT } from "../lib/i18n";
import { Button, Card, TextInput, cn } from "./ui";

function dayLabel(d: string | Date, t: (k: string) => string) {
  const x = new Date(d);
  const today = new Date();
  const yesterday = new Date(today.getTime() - 86_400_000);
  if (x.toDateString() === today.toDateString()) return t("messages.today");
  if (x.toDateString() === yesterday.toDateString()) return t("messages.yesterday");
  return x.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}
const timeLabel = (d: string | Date) =>
  new Date(d).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

/** Two-way 1:1 message thread with another user in the active workspace.
 *  Used by both the mentor (LearnerProfile) and the learner (Mentoring). */
export function MessageThread({ withUserId, title }: { withUserId: number; title?: string }) {
  const { t } = useT();
  const me = trpc.auth.me.useQuery();
  const thread = trpc.messages.thread.useQuery({ withUserId }, { refetchInterval: 15_000 });
  const utils = trpc.useUtils();
  const [body, setBody] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const send = trpc.messages.send.useMutation({
    onSuccess: async () => {
      setBody("");
      await utils.messages.thread.invalidate({ withUserId });
    },
  });

  // Opening a thread marks it read → clears the mentor's unread badge for this learner.
  const markRead = trpc.messages.markRead.useMutation({
    onSuccess: () => utils.mentor.learnerStats.invalidate(),
  });
  useEffect(() => {
    markRead.mutate({ withUserId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [withUserId]);

  // Keep the latest message in view as the thread grows.
  const count = thread.data?.length ?? 0;
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "nearest" });
  }, [count, withUserId]);

  const messages = thread.data ?? [];

  return (
    <Card className="p-6">
      <h2 className="mb-4 text-base font-semibold text-navy-900">{title ?? t("messages.title")}</h2>
      <div
        className="mb-4 flex max-h-80 flex-col gap-1.5 overflow-y-auto pr-1"
        role="log"
        aria-label={t("messages.history")}
      >
        {messages.length > 0 ? (
          messages.map((m, i) => {
            const mine = m.senderUserId === me.data?.id;
            const prev = messages[i - 1];
            const newDay =
              !prev ||
              new Date(prev.createdAt).toDateString() !== new Date(m.createdAt).toDateString();
            return (
              <div key={m.id} className="flex flex-col">
                {newDay && (
                  <div className="my-2 flex items-center gap-3" aria-hidden>
                    <span className="h-px flex-1 bg-gray-100" />
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-ink/35">
                      {dayLabel(m.createdAt, t)}
                    </span>
                    <span className="h-px flex-1 bg-gray-100" />
                  </div>
                )}
                <div
                  className={cn(
                    "max-w-[78%] rounded-2xl px-3.5 py-2 text-sm",
                    mine ? "self-end bg-navy-900 text-white" : "self-start bg-gray-100 text-ink",
                  )}
                >
                  {m.body}
                  <span
                    className={cn(
                      "ml-2 align-baseline text-[10px]",
                      mine ? "text-white/50" : "text-ink/40",
                    )}
                  >
                    {timeLabel(m.createdAt)}
                  </span>
                </div>
              </div>
            );
          })
        ) : (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-navy/5 text-navy/50">
              <MessageSquare className="h-5 w-5" />
            </span>
            <p className="text-sm text-ink/45">{t("messages.empty")}</p>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (body.trim()) send.mutate({ toUserId: withUserId, body: body.trim() });
        }}
      >
        <TextInput
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={t("messages.placeholder")}
          aria-label={t("messages.messageText")}
          className="flex-1"
        />
        <Button type="submit" icon={Send} disabled={send.isPending || !body.trim()}>
          {t("messages.send")}
        </Button>
      </form>
    </Card>
  );
}
