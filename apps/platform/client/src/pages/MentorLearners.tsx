import { Link } from "wouter";
import { trpc } from "../lib/trpc";

export default function MentorLearners() {
  const learners = trpc.mentor.myLearners.useQuery();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy">My learners</h1>
        <p className="text-ink/60">Learners assigned to you in this workspace.</p>
      </div>

      {learners.isLoading ? (
        <p className="text-ink/50">Loading…</p>
      ) : learners.data && learners.data.length > 0 ? (
        <div className="space-y-3">
          {learners.data.map((l) => (
            <Link
              key={l.id}
              to={`/mentor/${l.id}`}
              className="block rounded-xl border border-gray-200 bg-white p-5 transition hover:border-navy/40 hover:shadow-sm"
            >
              <div className="font-semibold text-navy">{l.name ?? l.email}</div>
              <div className="text-sm text-ink/50">{l.email}</div>
            </Link>
          ))}
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-gray-300 p-6 text-center text-ink/50">
          No learners assigned yet.
        </p>
      )}
    </div>
  );
}
