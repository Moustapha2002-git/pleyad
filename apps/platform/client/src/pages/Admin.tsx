import { useState } from "react";
import {
  AlertTriangle,
  Building2,
  ChevronRight,
  GraduationCap,
  KeyRound,
  Search,
  Shield,
  UserPlus,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Link } from "wouter";
import { trpc } from "../lib/trpc";
import { InviteAndImport } from "../components/InviteAndImport";
import { useToast } from "../components/Toast";
import {
  Avatar,
  Badge,
  Button,
  Card,
  ListSkeleton,
  PageHeader,
  Select,
  TextInput,
  cn,
} from "../components/ui";

type Role = "member" | "mentor" | "admin";
const ROLE_LABEL: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  manager: "Manager",
  mentor: "Mentor",
  member: "Learner",
};

type Filter = "all" | "learners" | "mentors" | "admins" | "no_mentor";
const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "learners", label: "Learners" },
  { key: "mentors", label: "Mentors" },
  { key: "admins", label: "Admins" },
  { key: "no_mentor", label: "Needs mentor" },
];

function StatCard({
  icon: Icon,
  value,
  label,
  tone = "bg-navy/10 text-navy",
}: {
  icon: LucideIcon;
  value: number;
  label: string;
  tone?: string;
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

export default function Admin() {
  const me = trpc.auth.me.useQuery();
  const members = trpc.admin.members.useQuery();
  const utils = trpc.useUtils();
  const toast = useToast();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("member");
  const [created, setCreated] = useState<{ email: string; tempPassword: string } | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [orgName, setOrgName] = useState<string | null>(null);

  const refresh = () => utils.admin.members.invalidate();
  const addMember = trpc.admin.addMember.useMutation({
    onSuccess: (res, vars) => {
      if (res.tempPassword) setCreated({ email: vars.email, tempPassword: res.tempPassword });
      setName("");
      setEmail("");
      setRole("member");
      refresh();
      toast.success(`${vars.name} added to the workspace`);
    },
    onError: (e) => toast.error(e.message),
  });
  const setMemberRole = trpc.admin.setRole.useMutation({
    onSuccess: () => {
      refresh();
      toast.success("Role updated");
    },
    onError: (e) => toast.error(e.message),
  });
  const assignMentor = trpc.admin.assignMentor.useMutation({
    onSuccess: () => {
      refresh();
      toast.success("Mentor assigned");
    },
    onError: (e) => toast.error(e.message),
  });
  const unassignMentor = trpc.admin.unassignMentor.useMutation({
    onSuccess: () => {
      refresh();
      toast.info("Mentor unassigned");
    },
    onError: (e) => toast.error(e.message),
  });
  const renameWorkspace = trpc.admin.renameWorkspace.useMutation({
    onSuccess: async () => {
      await Promise.all([utils.auth.me.invalidate(), utils.org.myWorkspaces.invalidate()]);
      setOrgName(null);
      toast.success("Workspace renamed");
    },
    onError: (e) => toast.error(e.message),
  });

  const currentOrgName = me.data?.activeOrganization?.name ?? "Workspace";
  const all = members.data ?? [];
  const mentors = all.filter((m) => ["mentor", "admin", "owner"].includes(m.role));
  const learners = all.filter((m) => m.role === "member");
  const noMentor = learners.filter((l) => !l.mentorUserId);

  const q = query.trim().toLowerCase();
  const visible = all.filter((m) => {
    if (q && !`${m.name ?? ""} ${m.email ?? ""}`.toLowerCase().includes(q)) return false;
    switch (filter) {
      case "learners":
        return m.role === "member";
      case "mentors":
        return m.role === "mentor";
      case "admins":
        return m.role === "admin" || m.role === "owner";
      case "no_mentor":
        return m.role === "member" && !m.mentorUserId;
      default:
        return true;
    }
  });

  // The name being edited in the org-settings card (falls back to the live name).
  const editedName = orgName ?? currentOrgName;

  return (
    <div className="space-y-6">
      <PageHeader title="Admin" subtitle={`Manage ${currentOrgName}`} />

      {/* Overview stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={Users} value={all.length} label="Members" />
        <StatCard
          icon={GraduationCap}
          value={learners.length}
          label="Learners"
          tone="bg-dim-knowledge/10 text-dim-knowledge"
        />
        <StatCard
          icon={Shield}
          value={mentors.length}
          label="Mentors & staff"
          tone="bg-gold/15 text-gold"
        />
        <StatCard
          icon={AlertTriangle}
          value={noMentor.length}
          label="Learners without mentor"
          tone={
            noMentor.length > 0
              ? "bg-red-500/12 text-red-600"
              : "bg-emerald-500/12 text-emerald-600"
          }
        />
      </div>

      {/* Add member */}
      <Card className="p-6">
        <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-navy-900">
          <UserPlus className="h-4 w-4" /> Add a member
        </h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim() && email.trim())
              addMember.mutate({ name: name.trim(), email: email.trim(), role });
          }}
          className="flex flex-col gap-3 sm:flex-row"
        >
          <TextInput
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Full name"
            className="sm:flex-1"
          />
          <TextInput
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="sm:flex-1"
          />
          <Select value={role} onChange={(e) => setRole(e.target.value as Role)}>
            <option value="member">Learner</option>
            <option value="mentor">Mentor</option>
            <option value="admin">Admin</option>
          </Select>
          <Button type="submit" icon={UserPlus} disabled={addMember.isPending}>
            Add
          </Button>
        </form>

        {created && (
          <div className="mt-4 flex items-start gap-3 rounded-xl border border-gold/40 bg-gold/10 p-4">
            <KeyRound className="mt-0.5 h-5 w-5 text-gold" />
            <div className="text-sm">
              <p className="font-semibold text-navy-900">Account created for {created.email}</p>
              <p className="text-ink/70">
                Share this temporary password (shown once):{" "}
                <span className="rounded bg-white px-2 py-0.5 font-mono font-semibold">
                  {created.tempPassword}
                </span>
              </p>
            </div>
          </div>
        )}
      </Card>

      {/* Join links + cohort import */}
      <InviteAndImport mentors={mentors} />

      {/* Members */}
      <Card className="p-4 sm:p-6">
        <div className="mb-4 flex flex-col gap-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/35" />
            <TextInput
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or email…"
              className="pl-9"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={cn(
                  "rounded-full border px-3 py-1 text-sm font-medium transition",
                  filter === f.key
                    ? "border-navy-900 bg-navy-900 text-white"
                    : "border-gray-200 text-ink/60 hover:border-navy/40",
                  f.key === "no_mentor" && noMentor.length > 0 && filter !== f.key
                    ? "border-red-200 text-red-600"
                    : "",
                )}
              >
                {f.label}
                {f.key === "no_mentor" && noMentor.length > 0 ? ` (${noMentor.length})` : ""}
              </button>
            ))}
          </div>
        </div>

        {members.isLoading ? (
          <ListSkeleton rows={4} />
        ) : visible.length === 0 ? (
          <p className="px-1 py-6 text-center text-sm text-ink/45">
            No members match this search.
          </p>
        ) : (
          <div className="divide-y divide-gray-100">
            {visible.map((m) => {
              const isLearner = m.role === "member";
              const selfOwner = m.role === "owner";
              return (
                <div key={m.userId} className="flex flex-wrap items-center gap-3 py-3">
                  <Avatar name={m.name ?? m.email ?? "?"} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium text-navy-900">
                        {m.name ?? m.email}
                      </span>
                      {isLearner && !m.mentorUserId && (
                        <span className="rounded-full bg-red-500/12 px-2 py-0.5 text-xs font-medium text-red-600">
                          No mentor
                        </span>
                      )}
                    </div>
                    <div className="truncate text-sm text-ink/50">{m.email}</div>
                  </div>

                  {/* Role */}
                  {selfOwner ? (
                    <Badge className="bg-navy-900 text-white">Owner</Badge>
                  ) : (
                    <Select
                      value={m.role}
                      onChange={(e) =>
                        setMemberRole.mutate({ userId: m.userId, role: e.target.value as Role })
                      }
                      className="py-1.5 text-xs"
                    >
                      <option value="member">Learner</option>
                      <option value="mentor">Mentor</option>
                      <option value="admin">Admin</option>
                    </Select>
                  )}

                  {/* Mentor assignment (learners only) */}
                  {isLearner && (
                    <Select
                      value={m.mentorUserId ?? ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === "") {
                          if (m.mentorUserId)
                            unassignMentor.mutate({
                              learnerUserId: m.userId,
                              mentorUserId: m.mentorUserId,
                            });
                        } else {
                          assignMentor.mutate({
                            learnerUserId: m.userId,
                            mentorUserId: Number(val),
                          });
                        }
                      }}
                      className="py-1.5 text-xs"
                    >
                      <option value="">No mentor</option>
                      {mentors.map((mentor) => (
                        <option key={mentor.userId} value={mentor.userId}>
                          Mentor: {mentor.name ?? mentor.email}
                        </option>
                      ))}
                    </Select>
                  )}

                  {!isLearner && !selfOwner && <Badge>{ROLE_LABEL[m.role] ?? m.role}</Badge>}

                  {/* Learner drill-through → same profile mentors see (admins allowed) */}
                  {isLearner && (
                    <Link
                      to={`/mentor/${m.userId}`}
                      className="inline-flex items-center gap-0.5 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-navy/70 transition hover:bg-gray-50 hover:text-navy"
                    >
                      Profile <ChevronRight className="h-3.5 w-3.5" />
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Workspace settings */}
      <Card className="p-6">
        <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-navy-900">
          <Building2 className="h-4 w-4" /> Workspace settings
        </h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const next = editedName.trim();
            if (next.length >= 2 && next !== currentOrgName)
              renameWorkspace.mutate({ name: next });
          }}
          className="flex flex-col gap-3 sm:flex-row sm:items-end"
        >
          <label className="flex-1 text-sm">
            <span className="mb-1 block font-medium text-ink/80">Workspace name</span>
            <TextInput value={editedName} onChange={(e) => setOrgName(e.target.value)} />
          </label>
          <Button
            type="submit"
            disabled={
              renameWorkspace.isPending ||
              editedName.trim().length < 2 ||
              editedName.trim() === currentOrgName
            }
          >
            {renameWorkspace.isPending ? "Saving…" : "Rename"}
          </Button>
        </form>
        <p className="mt-3 text-xs text-ink/45">
          Logo & brand colors per workspace are coming with white-label theming.
        </p>
      </Card>
    </div>
  );
}
