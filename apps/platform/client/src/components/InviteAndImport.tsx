import { useMemo, useState } from "react";
import { Copy, Download, Link2, Upload, X } from "lucide-react";
import { trpc } from "../lib/trpc";
import { useToast } from "./Toast";
import { Badge, Button, Card, Select, Textarea, cn } from "./ui";

type Role = "member" | "mentor" | "admin";
const ROLE_LABEL: Record<string, string> = { member: "Learner", mentor: "Mentor", admin: "Admin" };

type ImportResult = {
  email: string;
  name: string;
  status: "created" | "added" | "already_member";
  tempPassword: string | null;
};

/** "Name, email" per line (or just an email) → rows. Invalid lines are reported. */
function parseRows(text: string) {
  const rows: { name: string; email: string }[] = [];
  const bad: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const parts = line.split(/[,;\t]/).map((p) => p.trim()).filter(Boolean);
    const email = parts.find((p) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p));
    if (!email) {
      bad.push(line);
      continue;
    }
    const name = parts.find((p) => p !== email) ?? email.split("@")[0]!.replace(/[._-]+/g, " ");
    rows.push({ name, email });
  }
  return { rows, bad };
}

export function InviteAndImport({
  mentors,
}: {
  mentors: { userId: number; name: string | null; email: string | null }[];
}) {
  const utils = trpc.useUtils();
  const toast = useToast();

  // ── Join links ──────────────────────────────────────────────────────────
  const invites = trpc.admin.listInvites.useQuery();
  const [newRole, setNewRole] = useState<Role>("member");
  const createInvite = trpc.admin.createInvite.useMutation({
    onSuccess: () => {
      utils.admin.listInvites.invalidate();
      toast.success("Join link created");
    },
    onError: (e) => toast.error(e.message),
  });
  const revokeInvite = trpc.admin.revokeInvite.useMutation({
    onSuccess: () => {
      utils.admin.listInvites.invalidate();
      toast.info("Join link revoked");
    },
    onError: (e) => toast.error(e.message),
  });

  const linkFor = (token: string) => `${window.location.origin}/register?invite=${token}`;
  const copy = async (token: string) => {
    await navigator.clipboard.writeText(linkFor(token));
    toast.success("Link copied — share it with your cohort");
  };

  // ── Bulk import ─────────────────────────────────────────────────────────
  const [csv, setCsv] = useState("");
  const [mentorId, setMentorId] = useState("");
  const [results, setResults] = useState<ImportResult[] | null>(null);
  const parsed = useMemo(() => parseRows(csv), [csv]);
  const bulkImport = trpc.admin.bulkImport.useMutation({
    onSuccess: (res) => {
      setResults(res.results);
      setCsv("");
      utils.admin.members.invalidate();
      const created = res.results.filter((r) => r.status === "created").length;
      toast.success(`Imported ${res.results.length} learners (${created} new accounts)`);
    },
    onError: (e) => toast.error(e.message),
  });

  const downloadCredentials = () => {
    if (!results) return;
    const lines = [
      "name,email,temporary_password,status",
      ...results.map((r) => `"${r.name}",${r.email},${r.tempPassword ?? ""},${r.status}`),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "pleyad-credentials.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="p-6">
      <h2 className="mb-1 flex items-center gap-2 text-base font-semibold text-navy-900">
        <Link2 className="h-4 w-4" /> Invite & bulk import
      </h2>
      <p className="mb-5 text-sm text-ink/55">
        Share a join link, or import a whole cohort from a list — no email server needed.
      </p>

      {/* Join links */}
      <div className="space-y-2">
        {(invites.data ?? []).map((inv) => (
          <div
            key={inv.id}
            className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-100 p-3"
          >
            <Badge>{ROLE_LABEL[inv.role] ?? inv.role}</Badge>
            <code className="min-w-0 flex-1 truncate text-xs text-ink/60">{linkFor(inv.token)}</code>
            <span className="text-xs text-ink/40">used {inv.usedCount}×</span>
            <button
              onClick={() => copy(inv.token)}
              className="rounded-lg border border-gray-200 p-2 text-ink/60 transition hover:bg-gray-50"
              aria-label="Copy link"
            >
              <Copy className="h-4 w-4" />
            </button>
            <button
              onClick={() => revokeInvite.mutate({ inviteId: inv.id })}
              className="rounded-lg border border-gray-200 p-2 text-ink/50 transition hover:bg-gray-50"
              aria-label="Revoke link"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
        <div className="flex items-center gap-2">
          <Select value={newRole} onChange={(e) => setNewRole(e.target.value as Role)}>
            <option value="member">Learner link</option>
            <option value="mentor">Mentor link</option>
            <option value="admin">Admin link</option>
          </Select>
          <Button
            variant="secondary"
            icon={Link2}
            onClick={() => createInvite.mutate({ role: newRole })}
            disabled={createInvite.isPending}
          >
            New join link
          </Button>
        </div>
      </div>

      {/* Bulk import */}
      <div className="mt-6 border-t border-gray-100 pt-5">
        <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-navy-900">
          <Upload className="h-4 w-4" /> Import a cohort (CSV)
        </h3>
        <Textarea
          value={csv}
          onChange={(e) => setCsv(e.target.value)}
          rows={5}
          placeholder={"One learner per line:\nAminata Ba, aminata@example.com\nOmar Kane, omar@example.com"}
        />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Select value={mentorId} onChange={(e) => setMentorId(e.target.value)}>
            <option value="">No mentor (assign later)</option>
            {mentors.map((m) => (
              <option key={m.userId} value={m.userId}>
                Mentor for all: {m.name ?? m.email}
              </option>
            ))}
          </Select>
          <Button
            icon={Upload}
            onClick={() =>
              bulkImport.mutate({
                rows: parsed.rows,
                mentorUserId: mentorId ? Number(mentorId) : undefined,
              })
            }
            disabled={parsed.rows.length === 0 || bulkImport.isPending}
          >
            {bulkImport.isPending
              ? "Importing…"
              : `Import ${parsed.rows.length > 0 ? parsed.rows.length : ""} learner${parsed.rows.length === 1 ? "" : "s"}`}
          </Button>
          {parsed.bad.length > 0 && (
            <span className="text-xs text-red-600">
              {parsed.bad.length} line{parsed.bad.length === 1 ? "" : "s"} without a valid email
              skipped
            </span>
          )}
        </div>

        {results && (
          <div className="mt-4 rounded-xl border border-gold/40 bg-gold/10 p-4">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-navy-900">
                Import complete — credentials are shown once. Download and share them securely.
              </p>
              <Button variant="secondary" icon={Download} onClick={downloadCredentials}>
                Download CSV
              </Button>
            </div>
            <div className="max-h-56 space-y-1 overflow-y-auto">
              {results.map((r) => (
                <div key={r.email} className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-medium text-navy-900">{r.name}</span>
                  <span className="text-ink/50">{r.email}</span>
                  {r.tempPassword ? (
                    <code className="rounded bg-white px-1.5 py-0.5 font-mono text-xs">
                      {r.tempPassword}
                    </code>
                  ) : (
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-xs",
                        r.status === "already_member"
                          ? "bg-gray-200/70 text-ink/60"
                          : "bg-emerald-500/12 text-emerald-700",
                      )}
                    >
                      {r.status === "already_member" ? "already a member" : "existing account added"}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
