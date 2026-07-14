import { useState } from "react";
import { ArrowLeft, ArrowRight, Check, CheckCircle2, ExternalLink, Plus } from "lucide-react";
import { Link } from "wouter";
import { trpc } from "../lib/trpc";
import { Celebration } from "../components/Celebration";
import { useToast } from "../components/Toast";
import { Button, Card, ProgressBar, Select, Spinner, TextInput, cn } from "../components/ui";

const PLATFORMS = ["youtube", "coursera", "udemy", "edx", "linkedin", "other"] as const;
type Platform = (typeof PLATFORMS)[number];

export default function PlaylistDetail({ id }: { id: number }) {
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
  const setStatus = trpc.playlists.setItemStatus.useMutation({ onSuccess: refresh });

  if (playlist.isLoading) return <Spinner label="Loading…" />;
  if (!playlist.data) return <p className="text-ink/50">Playlist not found.</p>;
  const p = playlist.data;

  const nextItem = p.items.find((i) => !i.done);
  const isComplete = p.itemCount > 0 && p.progress === 100;

  const toggle = (it: (typeof p.items)[number]) => {
    const willComplete = !it.done && p.itemCount > 0 && p.completedCount + 1 === p.itemCount;
    setStatus.mutate(
      { resourceId: it.resourceId, done: !it.done },
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

      <Card className="p-6">
        <h2 className="mb-4 text-base font-semibold text-navy-900">Courses</h2>
        {p.items.length === 0 ? (
          <p className="text-ink/50">No courses yet — add the first below.</p>
        ) : (
          <ul className="space-y-2">
            {p.items.map((it) => (
              <li
                key={it.itemId}
                className={cn(
                  "flex items-center gap-3 rounded-xl border px-3 py-2.5 transition",
                  it.itemId === nextItem?.itemId
                    ? "border-navy/30 bg-navy/[0.03] ring-1 ring-navy/10"
                    : "border-gray-100",
                )}
              >
                <button
                  onClick={() => toggle(it)}
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-md border transition",
                    it.done
                      ? "border-navy-900 bg-navy-900 text-white"
                      : "border-gray-300 text-transparent hover:border-navy/50",
                  )}
                  aria-label={it.done ? "Mark not done" : "Mark done"}
                >
                  <Check className="h-4 w-4" />
                </button>
                <div className="flex-1">
                  <span
                    className={cn("font-medium", it.done ? "text-ink/40 line-through" : "text-ink")}
                  >
                    {it.title}
                  </span>
                  {it.platform && (
                    <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-ink/50">
                      {it.platform}
                    </span>
                  )}
                </div>
                {it.url && (
                  <a
                    href={it.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-navy/60 transition hover:text-navy"
                  >
                    Open <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

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
