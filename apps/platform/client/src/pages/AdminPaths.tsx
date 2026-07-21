import { useState } from "react";
import {
  CheckCircle2,
  Layers,
  Pencil,
  Plus,
  Route as RouteIcon,
  Search,
  Trash2,
  TrendingUp,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useLocation } from "wouter";
import { trpc } from "../lib/trpc";
import { useT } from "../lib/i18n";
import { DimensionChip } from "../components/DimensionGauges";
import { useToast } from "../components/Toast";
import { platformTile, thumbnailFor } from "../lib/thumbnails";
import {
  Button,
  Card,
  EmptyState,
  ListSkeleton,
  PageHeader,
  ProgressBar,
  Select,
  TextInput,
  cn,
} from "../components/ui";

const ALL_DIMENSIONS = [
  { key: "knowledge" },
  { key: "skills" },
  { key: "human_development" },
] as const;
type Dim = (typeof ALL_DIMENSIONS)[number]["key"];
type Sort = "title" | "enrolled" | "progress" | "newest";

function Stat({ icon: Icon, value, label, tone = "bg-navy/10 text-navy" }: {
  icon: LucideIcon; value: string | number; label: string; tone?: string;
}) {
  return (
    <Card className="p-3 sm:p-4">
      <div className="flex items-center justify-between">
        <span className={cn("flex h-8 w-8 items-center justify-center rounded-lg", tone)}>
          <Icon className="h-4 w-4" />
        </span>
        <span className="text-2xl font-bold leading-none text-navy-900">{value}</span>
      </div>
      <div className="mt-2 text-[11px] leading-tight text-ink/55 sm:text-xs">{label}</div>
    </Card>
  );
}

export default function AdminPaths() {
  const { t } = useT();
  const [, navigate] = useLocation();
  const toast = useToast();
  const utils = trpc.useUtils();

  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<Sort>("title");
  const dir = trpc.admin.pathsDirectory.useQuery({ search: search || undefined, sort });

  // Inline creator
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [dims, setDims] = useState<Dim[]>([]);
  const createPath = trpc.paths.create.useMutation({
    onSuccess: (res) => {
      toast.success(t("adminPaths.pathCreated"));
      navigate(`/paths/${res.id}`);
    },
    onError: (e) => toast.error(e.message),
  });
  const toggleDim = (d: Dim) =>
    setDims((s) => (s.includes(d) ? s.filter((x) => x !== d) : [...s, d]));

  const deletePath = trpc.admin.deletePath.useMutation({
    onSuccess: () => {
      utils.admin.pathsDirectory.invalidate();
      toast.info(t("adminPaths.pathDeleted"));
    },
    onError: (e) => toast.error(e.message),
  });

  const data = dir.data;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("adminPaths.title")}
        subtitle={t("adminPaths.subtitle")}
        action={
          <Button icon={Plus} variant="secondary" onClick={() => setShowCreate((s) => !s)}>
            {showCreate ? t("common.close") : t("adminPaths.newPath")}
          </Button>
        }
      />

      {showCreate && (
        <Card className="p-6">
          <h2 className="mb-1 text-base font-semibold text-navy-900">{t("adminPaths.createTitle")}</h2>
          <p className="mb-4 text-sm text-ink/55">{t("adminPaths.createHint")}</p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (title.trim()) createPath.mutate({ title: title.trim(), dimensions: dims });
            }}
            className="space-y-4"
          >
            <TextInput
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("adminPaths.pathTitlePlaceholder")}
            />
            <div className="flex flex-wrap gap-2">
              {ALL_DIMENSIONS.map((d) => (
                <button
                  type="button"
                  key={d.key}
                  onClick={() => toggleDim(d.key)}
                  className={cn(
                    "rounded-full border px-3.5 py-1.5 text-sm font-medium transition",
                    dims.includes(d.key)
                      ? "border-navy-900 bg-navy-900 text-white"
                      : "border-gray-200 text-ink/70 hover:border-navy/40",
                  )}
                >
                  {t("dimensions." + d.key)}
                </button>
              ))}
            </div>
            <Button type="submit" disabled={!title.trim() || createPath.isPending}>
              {createPath.isPending
                ? t("adminPaths.creating")
                : t("adminPaths.createAndAddSkills")}
            </Button>
          </form>
        </Card>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={RouteIcon} value={data?.stats.total ?? "…"} label={t("adminPaths.statPaths")} />
        <Stat
          icon={Users}
          value={data?.stats.totalEnrollments ?? "…"}
          label={t("adminPaths.statEnrollments")}
          tone="bg-dim-knowledge/10 text-dim-knowledge"
        />
        <Stat
          icon={TrendingUp}
          value={`${data?.stats.avgProgress ?? "…"}%`}
          label={t("adminPaths.statAvgProgress")}
          tone="bg-gold/15 text-gold"
        />
        <Stat
          icon={Layers}
          value={data?.stats.unassigned ?? "…"}
          label={t("adminPaths.statUnassigned")}
          tone={
            (data?.stats.unassigned ?? 0) > 0
              ? "bg-amber-500/15 text-amber-600"
              : "bg-emerald-500/12 text-emerald-600"
          }
        />
      </div>

      {/* Controls */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative sm:flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/35" />
          <TextInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("adminPaths.searchPlaceholder")}
            className="pl-9"
          />
        </div>
        <Select value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
          <option value="title">{t("adminPaths.sortTitle")}</option>
          <option value="enrolled">{t("adminPaths.sortEnrolled")}</option>
          <option value="progress">{t("adminPaths.sortProgress")}</option>
          <option value="newest">{t("adminPaths.sortNewest")}</option>
        </Select>
      </div>

      {/* Cards */}
      {dir.isLoading ? (
        <ListSkeleton rows={4} />
      ) : (data?.rows.length ?? 0) === 0 ? (
        <EmptyState
          icon={RouteIcon}
          title={t("adminPaths.emptyTitle")}
          description={t("adminPaths.emptyDesc")}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {data!.rows.map((p) => (
            <Card key={p.id} className="flex flex-col overflow-hidden">
              {/* Skill thumbnail strip */}
              <button
                onClick={() => navigate(`/paths/${p.id}`)}
                className="flex h-24 w-full cursor-pointer"
                aria-label={t("adminPaths.manageAria", { title: p.title })}
              >
                {p.previewSkills.length > 0 ? (
                  p.previewSkills.map((s, i) => {
                    const thumb = thumbnailFor(s.url, s.thumbnailUrl);
                    return (
                      <span
                        key={i}
                        className="relative block h-full flex-1 overflow-hidden bg-gradient-to-br from-navy-800 to-navy-950"
                      >
                        {thumb ? (
                          <img src={thumb} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <span className="flex h-full w-full items-center justify-center px-1 text-center text-[9px] font-semibold uppercase tracking-wide text-white/60">
                            {s.title.slice(0, 18)}
                          </span>
                        )}
                      </span>
                    );
                  })
                ) : (
                  <span className="flex h-full w-full items-center justify-center bg-gradient-to-br from-navy-800 to-navy-950 text-xs font-semibold uppercase tracking-widest text-white/50">
                    {t("adminPaths.noSkillsYet")}
                  </span>
                )}
              </button>

              <div className="flex flex-1 flex-col gap-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-semibold text-navy-900">{p.title}</span>
                  <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-ink/55">
                    {p.skillCount === 1
                      ? t("adminPaths.skillCountOne", { n: p.skillCount })
                      : t("adminPaths.skillCount", { n: p.skillCount })}
                  </span>
                </div>
                {p.dimensions.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {p.dimensions.map((d) => (
                      <DimensionChip key={d} dimension={d} />
                    ))}
                  </div>
                )}

                <div className="mt-1 flex items-center gap-2">
                  <ProgressBar value={p.avgProgress} className="flex-1" />
                  <span className="text-sm font-semibold text-navy-900">{p.avgProgress}%</span>
                </div>
                <div className="text-xs text-ink/50">
                  {t("adminPaths.enrolled", { n: p.enrolledCount })} ·{" "}
                  <span className="inline-flex items-center gap-0.5">
                    <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                    {t("adminPaths.completedLearners", { n: p.completedLearners })}
                  </span>
                  {p.creatorName ? t("adminPaths.byCreator", { name: p.creatorName }) : ""}
                </div>

                <div className="mt-auto flex items-center gap-2 border-t border-gray-100 pt-3">
                  <button
                    onClick={() => navigate(`/paths/${p.id}`)}
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-navy/70 transition hover:bg-gray-50 hover:text-navy"
                  >
                    <Pencil className="h-3.5 w-3.5" /> {t("adminPaths.manageAssign")}
                  </button>
                  <button
                    onClick={() => {
                      if (
                        window.confirm(
                          p.enrolledCount === 1
                            ? t("adminPaths.deleteConfirmOne", {
                                title: p.title,
                                n: p.enrolledCount,
                              })
                            : t("adminPaths.deleteConfirm", {
                                title: p.title,
                                n: p.enrolledCount,
                              }),
                        )
                      )
                        deletePath.mutate({ collectionId: p.id });
                    }}
                    className="inline-flex items-center rounded-lg border border-gray-200 p-1.5 text-ink/50 transition hover:bg-red-50 hover:text-red-600"
                    aria-label={t("adminPaths.deleteAria")}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
