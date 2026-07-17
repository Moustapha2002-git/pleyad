import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ExternalLink,
  Plus,
  UsersRound,
} from "lucide-react";
import { Link } from "wouter";
import { trpc } from "../lib/trpc";
import { Celebration } from "../components/Celebration";
import { DimensionChip } from "../components/DimensionGauges";
import { SkillCard } from "../components/SkillCard";
import { useToast } from "../components/Toast";
import { Avatar, Button, Card, ProgressBar, Select, Spinner, TextInput, cn } from "../components/ui";

const PLATFORMS = ["youtube", "coursera", "udemy", "edx", "linkedin", "other"] as const;
type Platform = (typeof PLATFORMS)[number];

export default function PathDetail({ id }: { id: number }) {
  const path = trpc.paths.get.useQuery({ id });
  const me = trpc.auth.me.useQuery();
  const utils = trpc.useUtils();
  const toast = useToast();
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [platform, setPlatform] = useState<Platform>("youtube");
  const [celebrate, setCelebrate] = useState(false);

  // ── Bulk assignment (mentors/admins in a team workspace) ────────────────
  const role = me.data?.activeOrganization?.role;
  const canAssign =
    me.data?.activeOrganization?.type === "team" &&
    (role === "mentor" || role === "admin" || role === "owner");
  const candidates = trpc.paths.candidates.useQuery(
    { collectionId: id },
    { enabled: canAssign },
  );
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkDue, setBulkDue] = useState("");
  const assignBulk = trpc.paths.assignBulk.useMutation({
    onSuccess: (res) => {
      setSelected(new Set());
      setBulkDue("");
      utils.paths.candidates.invalidate({ collectionId: id });
      toast.success(
        `Path assigned to ${res.assignedCount} learner${res.assignedCount === 1 ? "" : "s"}`,
      );
    },
    onError: (e) => toast.error(e.message),
  });
  const toggleLearner = (learnerId: number) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(learnerId)) next.delete(learnerId);
      else next.add(learnerId);
      return next;
    });
  const unassignedCandidates = (candidates.data ?? []).filter((c) => !c.alreadyAssigned);

  const refresh = async () => {
    await utils.paths.get.invalidate({ id });
    await utils.paths.list.invalidate();
    await utils.paths.progression.invalidate();
  };
  const addItem = trpc.paths.addItem.useMutation({
    onSuccess: async () => {
      setTitle("");
      setUrl("");
      await refresh();
      toast.success("Step added");
    },
    onError: (e) => toast.error(e.message),
  });
  const setProgress = trpc.paths.setItemProgress.useMutation({
    onSuccess: refresh,
    onError: (e) => toast.error(e.message),
  });

  if (path.isLoading) return <Spinner label="Loading…" />;
  if (!path.data) return <p className="text-ink/50">Path not found.</p>;
  const p = path.data;

  const nextItem = p.items.find((i) => !i.done);
  const isComplete = p.itemCount > 0 && p.progress === 100;

  const setSkillProgress = (it: (typeof p.items)[number], progress: number) => {
    const willComplete =
      !it.done && progress >= 100 && p.itemCount > 0 && p.completedCount + 1 === p.itemCount;
    setProgress.mutate(
      { resourceId: it.resourceId, progress },
      { onSuccess: () => willComplete && setCelebrate(true) },
    );
  };

  return (
    <div className="space-y-6">
      <Link
        to="/paths"
        className="inline-flex items-center gap-1 text-sm text-navy/60 transition hover:text-navy"
      >
        <ArrowLeft className="h-4 w-4" /> All paths
      </Link>

      <div>
        <h1 className="text-2xl font-bold tracking-tight text-navy-900">{p.title}</h1>
        {p.dimensions.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {p.dimensions.map((d) => (
              <DimensionChip key={d} dimension={d} />
            ))}
          </div>
        )}
        <div className="mt-4 flex items-center gap-3">
          <ProgressBar value={p.progress} className="flex-1" />
          <span className="text-sm font-semibold text-navy-900">{p.progress}%</span>
        </div>
      </div>

      {/* Completion / resume banner */}
      {isComplete ? (
        <Card className="flex items-center gap-3 border-emerald-200 bg-emerald-50 p-4">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
          <p className="text-sm font-medium text-emerald-900">
            You've completed this path — every step done. 🎉
          </p>
        </Card>
      ) : nextItem ? (
        <Card className="flex items-center gap-3 border-navy/15 bg-navy/[0.03] p-4">
          <ArrowRight className="h-5 w-5 shrink-0 text-navy" />
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-navy/50">
              Next up
            </div>
            <div className="truncate font-medium text-navy-900">{nextItem.title}</div>
          </div>
          {nextItem.url && (
            <a
              href={nextItem.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-lg bg-navy-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-navy-800"
            >
              Open <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </Card>
      ) : null}

      <div>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-base font-semibold text-navy-900">Skills in this path</h2>
          <span className="text-sm text-ink/45">
            {p.completedCount}/{p.itemCount} mastered
          </span>
        </div>
        {p.items.length === 0 ? (
          <Card className="p-6 text-ink/50">No skills yet — add the first below.</Card>
        ) : (
          <div className="space-y-2.5">
            {p.items.map((it) => (
              <SkillCard
                key={it.itemId}
                item={it}
                isNext={it.itemId === nextItem?.itemId}
                onProgress={(progress) => setSkillProgress(it, progress)}
              />
            ))}
          </div>
        )}
      </div>

      <Card className="p-6">
        <h2 className="mb-4 text-base font-semibold text-navy-900">Add a skill / course</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (title.trim())
              addItem.mutate({ pathId: id, title: title.trim(), platform, url: url || undefined });
          }}
          className="space-y-3"
        >
          <TextInput
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Step title (e.g. Python Basics — Coursera)"
          />
          <div className="flex flex-col gap-2 sm:flex-row">
            <Select value={platform} onChange={(e) => setPlatform(e.target.value as Platform)}>
              {PLATFORMS.map((pl) => (
                <option key={pl} value={pl}>
                  {pl}
                </option>
              ))}
            </Select>
            <TextInput
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="URL (optional)"
              className="flex-1"
            />
          </div>
          <Button type="submit" icon={Plus} disabled={addItem.isPending}>
            Add step
          </Button>
        </form>
      </Card>

      {/* Cohort assignment — one path, many learners */}
      {canAssign && (candidates.data?.length ?? 0) > 0 && (
        <Card className="p-6">
          <div className="mb-1 flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-base font-semibold text-navy-900">
              <UsersRound className="h-4 w-4" /> Assign this path
            </h2>
            {unassignedCandidates.length > 0 && (
              <button
                onClick={() =>
                  setSelected((s) =>
                    s.size === unassignedCandidates.length
                      ? new Set()
                      : new Set(unassignedCandidates.map((c) => c.id)),
                  )
                }
                className="text-xs font-medium text-navy/60 transition hover:text-navy"
              >
                {selected.size === unassignedCandidates.length ? "Clear selection" : "Select all"}
              </button>
            )}
          </div>
          <p className="mb-4 text-sm text-ink/55">
            Pick learners and assign them this path in one go.
          </p>

          <div className="mb-4 grid gap-1.5 sm:grid-cols-2">
            {(candidates.data ?? []).map((c) => {
              const checked = c.alreadyAssigned || selected.has(c.id);
              return (
                <button
                  key={c.id}
                  disabled={c.alreadyAssigned}
                  onClick={() => toggleLearner(c.id)}
                  className={cn(
                    "flex items-center gap-2.5 rounded-xl border px-3 py-2 text-left transition",
                    c.alreadyAssigned
                      ? "border-gray-100 opacity-50"
                      : checked
                        ? "border-navy-900 bg-navy/[0.04]"
                        : "border-gray-200 hover:border-navy/40",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border",
                      checked
                        ? "border-navy-900 bg-navy-900 text-white"
                        : "border-gray-300 text-transparent",
                    )}
                  >
                    <Check className="h-3.5 w-3.5" />
                  </span>
                  <Avatar name={c.name ?? c.email ?? "?"} className="h-7 w-7 text-[10px]" />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-navy-900">
                    {c.name ?? c.email}
                  </span>
                  {c.alreadyAssigned && (
                    <span className="shrink-0 text-[11px] text-ink/40">assigned</span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex flex-col gap-2 border-t border-gray-100 pt-4 sm:flex-row sm:items-end">
            <label className="text-sm">
              <span className="mb-1 block font-medium text-ink/80">Due (optional)</span>
              <TextInput
                type="date"
                value={bulkDue}
                onChange={(e) => setBulkDue(e.target.value)}
                className="sm:w-44"
              />
            </label>
            <Button
              icon={UsersRound}
              onClick={() =>
                assignBulk.mutate({
                  collectionId: id,
                  learnerUserIds: [...selected],
                  dueAt: bulkDue || null,
                })
              }
              disabled={selected.size === 0 || assignBulk.isPending}
            >
              {assignBulk.isPending
                ? "Assigning…"
                : `Assign to ${selected.size || ""} learner${selected.size === 1 ? "" : "s"}`}
            </Button>
          </div>
        </Card>
      )}

      {celebrate && (
        <Celebration
          title="Path complete!"
          message={`You finished "${p.title}". Your development gauges just moved.`}
          onClose={() => setCelebrate(false)}
        />
      )}
    </div>
  );
}
