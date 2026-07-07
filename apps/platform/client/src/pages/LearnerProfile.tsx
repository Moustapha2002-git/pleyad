import { useState } from "react";
import { ArrowLeft, CalendarPlus, Video } from "lucide-react";
import { Link } from "wouter";
import { trpc } from "../lib/trpc";
import { DimensionGauges } from "../components/DimensionGauges";
import { VideoCall } from "../components/VideoCall";
import { MessageThread } from "../components/MessageThread";
import { callRoomName } from "../lib/room";
import { Avatar, Button, Card, ProgressBar, Select, Spinner, TextInput } from "../components/ui";

export default function LearnerProfile({ learnerId }: { learnerId: number }) {
  const me = trpc.auth.me.useQuery();
  const profile = trpc.mentor.learnerProfile.useQuery({ learnerId });
  const utils = trpc.useUtils();
  const ring = trpc.calls.ring.useMutation();
  const cancel = trpc.calls.cancel.useMutation();
  const [inCall, setInCall] = useState(false);

  // Scheduling
  const [sessTitle, setSessTitle] = useState("Mentoring session");
  const [sessWhen, setSessWhen] = useState("");
  const [sessDuration, setSessDuration] = useState(30);
  const schedule = trpc.sessions.schedule.useMutation({
    onSuccess: () => {
      setSessWhen("");
      utils.sessions.mine.invalidate();
    },
  });

  const room = me.data
    ? callRoomName(me.data.activeOrganization?.publicId ?? "", me.data.id, learnerId)
    : "";

  const startCall = () => {
    if (room) ring.mutate({ toUserId: learnerId, room }); // ring the learner
    setInCall(true);
  };
  const endCall = () => {
    cancel.mutate({ toUserId: learnerId });
    setInCall(false);
  };

  if (profile.isLoading) return <Spinner label="Loading…" />;
  if (!profile.data) return <p className="text-ink/50">Not found.</p>;
  const p = profile.data;
  const name = p.learner.name ?? p.learner.email ?? "Learner";

  return (
    <div className="space-y-6">
      <Link
        to="/mentor"
        className="inline-flex items-center gap-1 text-sm text-navy/60 transition hover:text-navy"
      >
        <ArrowLeft className="h-4 w-4" /> My learners
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Avatar name={name} className="h-12 w-12 text-sm" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-navy-900">{name}</h1>
            <p className="text-ink/50">{p.learner.email}</p>
          </div>
        </div>
        <Button icon={Video} onClick={startCall}>
          Video call
        </Button>
      </div>

      {inCall && me.data && (
        <VideoCall
          room={room}
          displayName={me.data.name ?? me.data.email ?? "Mentor"}
          onClose={endCall}
        />
      )}

      {/* Schedule a session */}
      <Card className="p-6">
        <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-navy-900">
          <CalendarPlus className="h-4 w-4" /> Schedule a session
        </h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (sessWhen)
              schedule.mutate({
                learnerUserId: learnerId,
                title: sessTitle.trim() || "Mentoring session",
                scheduledAt: sessWhen,
                durationMinutes: sessDuration,
              });
          }}
          className="flex flex-col gap-3 sm:flex-row sm:items-end"
        >
          <label className="flex-1 text-sm">
            <span className="mb-1 block font-medium text-ink/80">Title</span>
            <TextInput value={sessTitle} onChange={(e) => setSessTitle(e.target.value)} />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-ink/80">When</span>
            <TextInput
              type="datetime-local"
              value={sessWhen}
              onChange={(e) => setSessWhen(e.target.value)}
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-ink/80">Minutes</span>
            <Select
              value={String(sessDuration)}
              onChange={(e) => setSessDuration(Number(e.target.value))}
            >
              <option value="15">15</option>
              <option value="30">30</option>
              <option value="45">45</option>
              <option value="60">60</option>
            </Select>
          </label>
          <Button type="submit" disabled={schedule.isPending || !sessWhen}>
            Schedule
          </Button>
        </form>
      </Card>

      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gold">
          Progress CV
        </h2>
        <DimensionGauges data={p.progression} />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-navy-900">Learning paths</h2>
        {p.paths.length > 0 ? (
          <div className="space-y-3">
            {p.paths.map((path) => (
              <Card key={path.id} className="p-4">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-navy-900">{path.title}</span>
                  <span className="text-sm text-ink/50">{path.progress}%</span>
                </div>
                <ProgressBar value={path.progress} className="mt-2" />
              </Card>
            ))}
          </div>
        ) : (
          <p className="text-ink/50">No paths yet.</p>
        )}
      </section>

      <MessageThread withUserId={learnerId} />
    </div>
  );
}
