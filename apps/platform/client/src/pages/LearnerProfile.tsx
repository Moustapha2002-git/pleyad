import { useState } from "react";
import { Link } from "wouter";
import { trpc } from "../lib/trpc";
import { DimensionGauges } from "../components/DimensionGauges";
import { VideoCall } from "../components/VideoCall";
import { callRoomName } from "../lib/room";

export default function LearnerProfile({ learnerId }: { learnerId: number }) {
  const me = trpc.auth.me.useQuery();
  const profile = trpc.mentor.learnerProfile.useQuery({ learnerId });
  const thread = trpc.messages.thread.useQuery({ withUserId: learnerId });
  const utils = trpc.useUtils();
  const [body, setBody] = useState("");
  const [inCall, setInCall] = useState(false);

  const send = trpc.messages.send.useMutation({
    onSuccess: async () => {
      setBody("");
      await utils.messages.thread.invalidate({ withUserId: learnerId });
    },
  });

  if (profile.isLoading) return <p className="text-ink/50">Loading…</p>;
  if (!profile.data) return <p className="text-ink/50">Not found.</p>;
  const p = profile.data;

  return (
    <div className="space-y-6">
      <Link to="/mentor" className="text-sm text-navy/70 hover:underline">
        ← My learners
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy">{p.learner.name ?? p.learner.email}</h1>
          <p className="text-ink/50">{p.learner.email}</p>
        </div>
        <button
          onClick={() => setInCall(true)}
          className="shrink-0 rounded-lg bg-navy px-4 py-2 text-sm text-white transition hover:bg-navy-600"
        >
          Start video call
        </button>
      </div>

      {inCall && me.data && (
        <VideoCall
          room={callRoomName(
            me.data.activeOrganization?.publicId ?? "",
            me.data.id,
            learnerId,
          )}
          displayName={me.data.name ?? me.data.email ?? "Mentor"}
          onClose={() => setInCall(false)}
        />
      )}

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gold">
          Progress CV
        </h2>
        <DimensionGauges data={p.progression} />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-navy">Learning paths</h2>
        {p.paths.length > 0 ? (
          <div className="space-y-3">
            {p.paths.map((path) => (
              <div key={path.id} className="rounded-xl border border-gray-200 bg-white p-4">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-navy">{path.title}</span>
                  <span className="text-sm text-ink/50">{path.progress}%</span>
                </div>
                <div className="mt-2 h-2 w-full rounded-full bg-gray-100">
                  <div
                    className="h-2 rounded-full bg-gold"
                    style={{ width: `${path.progress}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-ink/50">No paths yet.</p>
        )}
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold text-navy">Messages</h2>
        <div className="mb-4 max-h-64 space-y-2 overflow-y-auto">
          {thread.data && thread.data.length > 0 ? (
            thread.data.map((m) => {
              const mine = m.senderUserId === me.data?.id;
              return (
                <div
                  key={m.id}
                  className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                    mine ? "ml-auto bg-navy text-white" : "bg-gray-100 text-ink"
                  }`}
                >
                  {m.body}
                </div>
              );
            })
          ) : (
            <p className="text-ink/50">No messages yet.</p>
          )}
        </div>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (body.trim()) send.mutate({ toUserId: learnerId, body: body.trim() });
          }}
        >
          <input
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write a message…"
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-navy"
          />
          <button
            className="rounded-lg bg-navy px-4 py-2 text-white transition hover:bg-navy-600 disabled:opacity-50"
            disabled={send.isPending}
          >
            Send
          </button>
        </form>
      </section>
    </div>
  );
}
