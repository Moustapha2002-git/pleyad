import { useState } from "react";
import { trpc } from "../lib/trpc";
import { VideoCall } from "../components/VideoCall";
import { callRoomName } from "../lib/room";

export default function Mentoring() {
  const me = trpc.auth.me.useQuery();
  const mentors = trpc.mentor.myMentors.useQuery();
  const [callWith, setCallWith] = useState<{ id: number; name: string } | null>(null);

  const orgPublicId = me.data?.activeOrganization?.publicId ?? "";
  const myId = me.data?.id ?? 0;
  const myName = me.data?.name ?? me.data?.email ?? "Learner";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy">Mentoring</h1>
        <p className="text-ink/60">Your mentors in this workspace.</p>
      </div>

      {mentors.isLoading ? (
        <p className="text-ink/50">Loading…</p>
      ) : mentors.data && mentors.data.length > 0 ? (
        <div className="space-y-3">
          {mentors.data.map((m) => (
            <div
              key={m.id}
              className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-5"
            >
              <div>
                <div className="font-semibold text-navy">{m.name ?? m.email}</div>
                <div className="text-sm text-ink/50">Mentor</div>
              </div>
              <button
                onClick={() => setCallWith({ id: m.id, name: m.name ?? m.email ?? "Mentor" })}
                className="rounded-lg bg-navy px-4 py-2 text-sm text-white transition hover:bg-navy-600"
              >
                Start video call
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-gray-300 p-6 text-center text-ink/50">
          No mentor assigned yet.
        </p>
      )}

      {callWith && (
        <VideoCall
          room={callRoomName(orgPublicId, myId, callWith.id)}
          displayName={myName}
          onClose={() => setCallWith(null)}
        />
      )}
    </div>
  );
}
