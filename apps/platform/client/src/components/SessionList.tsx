import { useState } from "react";
import { CalendarDays, Pencil, Video, X } from "lucide-react";
import { trpc } from "../lib/trpc";
import { useToast } from "./Toast";
import { VideoCall } from "./VideoCall";
import { callRoomName } from "../lib/room";
import { Button, Card, TextInput, cn } from "./ui";

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

/** "live" while in progress, "soon" within 15 min of start, else null. */
function sessionState(s: Session): "live" | "soon" | null {
  const start = new Date(s.scheduledAt).getTime();
  const end = start + s.durationMinutes * 60_000;
  const now = Date.now();
  if (now >= start && now <= end) return "live";
  if (now >= start - 15 * 60_000 && now < start) return "soon";
  return null;
}

/** Date → value usable by <input type="datetime-local"> (local time, minutes precision). */
function toLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
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
  const toast = useToast();
  const cancel = trpc.sessions.cancel.useMutation({
    onSuccess: () => {
      utils.sessions.mine.invalidate();
      toast.info("Session cancelled");
    },
    onError: (e) => toast.error(e.message),
  });
  const reschedule = trpc.sessions.reschedule.useMutation({
    onSuccess: () => {
      utils.sessions.mine.invalidate();
      setEditing(null);
      toast.success("Session rescheduled");
    },
    onError: (e) => toast.error(e.message),
  });
  const [call, setCall] = useState<{ room: string } | null>(null);
  const [editing, setEditing] = useState<{ id: number; when: string } | null>(null);

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
        const state = sessionState(s);
        const isEditing = editing?.id === s.id;
        const minsToStart = Math.max(0, Math.round((when.getTime() - Date.now()) / 60_000));
        return (
          <Card key={s.id} className="p-4">
            <div className="flex flex-wrap items-center gap-3">
              <div
                className={cn(
                  "flex h-11 w-11 items-center justify-center rounded-xl",
                  state === "live"
                    ? "bg-emerald-500/12 text-emerald-600"
                    : state === "soon"
                      ? "bg-gold/15 text-gold"
                      : "bg-navy/5 text-navy",
                )}
              >
                <CalendarDays className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-navy-900">{s.title}</span>
                  {state === "live" && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/12 px-2 py-0.5 text-xs font-semibold text-emerald-600">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                      Live now
                    </span>
                  )}
                  {state === "soon" && (
                    <span className="rounded-full bg-gold/15 px-2 py-0.5 text-xs font-semibold text-gold">
                      Starts in {minsToStart}m
                    </span>
                  )}
                </div>
                <div className="text-sm text-ink/55">
                  with {other} · {formatWhen(when)} · {s.durationMinutes}m
                </div>
              </div>
              <Button
                icon={Video}
                variant={state ? "primary" : "secondary"}
                onClick={() => setCall({ room })}
              >
                Join
              </Button>
              {allowCancel && (
                <>
                  <button
                    onClick={() =>
                      setEditing(isEditing ? null : { id: s.id, when: toLocalInput(when) })
                    }
                    className={cn(
                      "rounded-lg border p-2 transition",
                      isEditing
                        ? "border-navy-900 bg-navy-900 text-white"
                        : "border-gray-200 text-ink/50 hover:bg-gray-50",
                    )}
                    aria-label="Reschedule session"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => cancel.mutate({ id: s.id })}
                    className="rounded-lg border border-gray-200 p-2 text-ink/50 transition hover:bg-gray-50"
                    aria-label="Cancel session"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </>
              )}
            </div>

            {/* Inline reschedule editor */}
            {isEditing && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (editing.when) reschedule.mutate({ id: s.id, scheduledAt: editing.when });
                }}
                className="mt-3 flex flex-col gap-2 border-t border-gray-100 pt-3 sm:flex-row sm:items-center"
              >
                <span className="text-sm font-medium text-ink/70">New time:</span>
                <TextInput
                  type="datetime-local"
                  value={editing.when}
                  onChange={(e) => setEditing({ id: s.id, when: e.target.value })}
                  className="sm:w-60"
                />
                <Button type="submit" disabled={reschedule.isPending || !editing.when}>
                  {reschedule.isPending ? "Saving…" : "Reschedule"}
                </Button>
              </form>
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
