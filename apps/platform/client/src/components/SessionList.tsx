import { useState } from "react";
import { CalendarDays, Video, X } from "lucide-react";
import { trpc } from "../lib/trpc";
import { VideoCall } from "./VideoCall";
import { callRoomName } from "../lib/room";
import { Button, Card } from "./ui";

type Session = {
  id: number;
  title: string;
  scheduledAt: string | Date;
  durationMinutes: number;
  mentorUserId: number;
  learnerUserId: number;
  mentorName: string | null;
  mentorEmail: string | null;
  learnerName: string | null;
  learnerEmail: string | null;
};

function formatWhen(dt: Date) {
  return dt.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function SessionList({
  sessions,
  allowCancel = true,
}: {
  sessions: Session[];
  allowCancel?: boolean;
}) {
  const me = trpc.auth.me.useQuery();
  const utils = trpc.useUtils();
  const cancel = trpc.sessions.cancel.useMutation({
    onSuccess: () => utils.sessions.mine.invalidate(),
  });
  const [call, setCall] = useState<{ room: string } | null>(null);

  const myId = me.data?.id ?? 0;
  const myName = me.data?.name ?? me.data?.email ?? "Me";
  const orgPublicId = me.data?.activeOrganization?.publicId ?? "";

  if (sessions.length === 0) return null;

  return (
    <div className="space-y-3">
      {sessions.map((s) => {
        const iAmMentor = s.mentorUserId === myId;
        const other = iAmMentor
          ? (s.learnerName ?? s.learnerEmail)
          : (s.mentorName ?? s.mentorEmail);
        const when = new Date(s.scheduledAt);
        const room = callRoomName(orgPublicId, s.mentorUserId, s.learnerUserId);
        return (
          <Card key={s.id} className="flex flex-wrap items-center gap-3 p-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-navy/5 text-navy">
              <CalendarDays className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-navy-900">{s.title}</div>
              <div className="text-sm text-ink/55">
                with {other} · {formatWhen(when)} · {s.durationMinutes}m
              </div>
            </div>
            <Button icon={Video} onClick={() => setCall({ room })}>
              Join
            </Button>
            {allowCancel && (
              <button
                onClick={() => cancel.mutate({ id: s.id })}
                className="rounded-lg border border-gray-200 p-2 text-ink/50 transition hover:bg-gray-50"
                aria-label="Cancel session"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </Card>
        );
      })}
      {call && (
        <VideoCall room={call.room} displayName={myName} onClose={() => setCall(null)} />
      )}
    </div>
  );
}
