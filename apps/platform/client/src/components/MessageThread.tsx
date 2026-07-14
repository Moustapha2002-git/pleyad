import { useEffect } from "react";
import { useState } from "react";
import { Send } from "lucide-react";
import { trpc } from "../lib/trpc";
import { Button, Card, TextInput, cn } from "./ui";

/** Two-way 1:1 message thread with another user in the active workspace.
 *  Used by both the mentor (LearnerProfile) and the learner (Mentoring). */
export function MessageThread({ withUserId, title }: { withUserId: number; title?: string }) {
  const me = trpc.auth.me.useQuery();
  const thread = trpc.messages.thread.useQuery({ withUserId });
  const utils = trpc.useUtils();
  const [body, setBody] = useState("");

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

  return (
    <Card className="p-6">
      <h2 className="mb-4 text-base font-semibold text-navy-900">{title ?? "Messages"}</h2>
      <div className="mb-4 flex max-h-72 flex-col gap-2 overflow-y-auto">
        {thread.data && thread.data.length > 0 ? (
          thread.data.map((m) => {
            const mine = m.senderUserId === me.data?.id;
            return (
              <div
                key={m.id}
                className={cn(
                  "max-w-[78%] rounded-2xl px-3.5 py-2 text-sm",
                  mine ? "self-end bg-navy-900 text-white" : "self-start bg-gray-100 text-ink",
                )}
              >
                {m.body}
              </div>
            );
          })
        ) : (
          <p className="text-sm text-ink/45">No messages yet. Say hello 👋</p>
        )}
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
          placeholder="Write a message…"
          className="flex-1"
        />
        <Button type="submit" icon={Send} disabled={send.isPending}>
          Send
        </Button>
      </form>
    </Card>
  );
}
