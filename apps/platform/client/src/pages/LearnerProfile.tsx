import { useState } from "react";
import { ArrowLeft, Video } from "lucide-react";
import { Link } from "wouter";
import { trpc } from "../lib/trpc";
import { DimensionGauges } from "../components/DimensionGauges";
import { VideoCall } from "../components/VideoCall";
import { MessageThread } from "../components/MessageThread";
import { callRoomName } from "../lib/room";
import { Avatar, Button, Card, ProgressBar, Spinner } from "../components/ui";

export default function LearnerProfile({ learnerId }: { learnerId: number }) {
  const me = trpc.auth.me.useQuery();
  const profile = trpc.mentor.learnerProfile.useQuery({ learnerId });
  const [inCall, setInCall] = useState(false);

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
        <Button icon={Video} onClick={() => setInCall(true)}>
          Video call
        </Button>
      </div>

      {inCall && me.data && (
        <VideoCall
          room={callRoomName(me.data.activeOrganization?.publicId ?? "", me.data.id, learnerId)}
          displayName={me.data.name ?? me.data.email ?? "Mentor"}
          onClose={() => setInCall(false)}
        />
      )}

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
