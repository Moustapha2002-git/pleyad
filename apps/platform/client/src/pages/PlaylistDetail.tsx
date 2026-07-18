import { useState } from "react";
import { ArrowLeft, ArrowRight, Check, CheckCircle2, ExternalLink, Plus } from "lucide-react";
import { Link, useLocation } from "wouter";
import { trpc } from "../lib/trpc";
import { Celebration } from "../components/Celebration";
import { SkillCard } from "../components/SkillCard";
import { useToast } from "../components/Toast";
import { Button, Card, ProgressBar, Select, Spinner, TextInput, cn } from "../components/ui";

const PLATFORMS = ["youtube", "coursera", "udemy", "edx", "linkedin", "other"] as const;
type Platform = (typeof PLATFORMS)[number];

export default function PlaylistDetail({ id }: { id: number }) {
  const [, navigate] = useLocation();
  const playlist = trpc.playlists.get.useQuery({ id });
  const utils = trpc.useUtils();
  const toast = useToast();
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [platform, setPlatform] = useState<Platform>("youtube");
  const [celebrate, setCelebrate] = useState(false);

  const refresh = async () => {
    await utils.playlists.get.invalidate({ id });
    await utils.playlists.mine.invalidate();
  };
  const addItem = trpc.playlists.addItem.useMutation({
    onSuccess: async () => {
      setTitle("");
      setUrl("");
      await refresh();
      toast.success("Course added");
    },
    onError: (e) => toast.error(e.message),
  });
  const setProgress = trpc.playlists.setItemProgress.useMutation({
    onSuccess: refresh,
    onError: (e) => toast.error(e.message),
  });

  if (playlist.isLoading) return <Spinner label="Loading…" />;
  if (!playlist.data) return <p className="text-ink/50">Playlist not found.</p>;
  const p = playlist.data;

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
        <ArrowLeft className="h-4 w-4" /> My Learning
      </Link>

      <div>
        <h1 className="text-2xl font-bold tracking-tight text-navy-900">{p.title}</h1>
        <div className="mt-4 flex items-center gap-3">
          <ProgressBar value={p.progress} className="flex-1" />
          <span className="text-sm font-semibold text-navy-900">{p.progress}%</span>
        </div>
      </div>

      {isComplete ? (
        <Card className="flex items-center gap-3 border-emerald-200 bg-emerald-50 p-4">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
          <p className="text-sm font-medium text-emerald-900">
            You've finished every course in this playlist. 🎉
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
          <button
            onClick={() => navigate(`/playlists/${id}/learn/${nextItem.resourceId}`)}
            className="inline-flex items-center gap-1 rounded-lg bg-navy-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-navy-800"
          >
            Start <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </Card>
      ) : null}

      <div>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-base font-semibold text-navy-900">Courses</h2>
          <span className="text-sm text-ink/45">
            {p.completedCount}/{p.itemCount} finished
          </span>
        </div>
        {p.items.length === 0 ? (
          <Card className="p-6 text-ink/50">No courses yet — add the first below.</Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {p.items.map((it) => (
              <SkillCard
                key={it.itemId}
                item={it}
                isNext={it.itemId === nextItem?.itemId}
                onProgress={(progress) => setSkillProgress(it, progress)}
                onOpen={() => navigate(`/playlists/${id}/learn/${it.resourceId}`)}
              />
            ))}
          </div>
        )}
      </div>

      <Card className="p-6">
        <h2 className="mb-4 text-base font-semibold text-navy-900">Add a course</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (title.trim())
              addItem.mutate({ playlistId: id, title: title.trim(), platform, url: url || undefined });
          }}
          className="space-y-3"
        >
          <TextInput
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Course title (e.g. React — Full Course)"
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
            Add course
          </Button>
        </form>
      </Card>

      {celebrate && (
        <Celebration
          title="Playlist complete!"
          message={`You finished every course in "${p.title}". Nicely done.`}
          onClose={() => setCelebrate(false)}
        />
      )}
    </div>
  );
}
