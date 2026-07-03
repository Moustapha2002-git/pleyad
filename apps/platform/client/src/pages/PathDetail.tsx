import { useState } from "react";
import { ArrowLeft, Check, ExternalLink, Plus } from "lucide-react";
import { Link } from "wouter";
import { trpc } from "../lib/trpc";
import { DimensionChip } from "../components/DimensionGauges";
import { Button, Card, ProgressBar, Select, Spinner, TextInput, cn } from "../components/ui";

const PLATFORMS = ["youtube", "coursera", "udemy", "edx", "linkedin", "other"] as const;
type Platform = (typeof PLATFORMS)[number];

export default function PathDetail({ id }: { id: number }) {
  const path = trpc.paths.get.useQuery({ id });
  const utils = trpc.useUtils();
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [platform, setPlatform] = useState<Platform>("youtube");

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
    },
  });
  const setStatus = trpc.paths.setItemStatus.useMutation({ onSuccess: refresh });

  if (path.isLoading) return <Spinner label="Loading…" />;
  if (!path.data) return <p className="text-ink/50">Path not found.</p>;
  const p = path.data;

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

      <Card className="p-6">
        <h2 className="mb-4 text-base font-semibold text-navy-900">Steps</h2>
        {p.items.length === 0 ? (
          <p className="text-ink/50">No steps yet — add the first below.</p>
        ) : (
          <ul className="space-y-2">
            {p.items.map((it) => (
              <li
                key={it.itemId}
                className="flex items-center gap-3 rounded-xl border border-gray-100 px-3 py-2.5"
              >
                <button
                  onClick={() =>
                    setStatus.mutate({ resourceId: it.resourceId, done: !it.done })
                  }
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
                    className={cn(
                      "font-medium",
                      it.done ? "text-ink/40 line-through" : "text-ink",
                    )}
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
        <h2 className="mb-4 text-base font-semibold text-navy-900">Add a step</h2>
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
    </div>
  );
}
