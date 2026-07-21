import { ChevronsUpDown } from "lucide-react";
import { trpc } from "../lib/trpc";
import { useT } from "../lib/i18n";

export function WorkspaceSwitcher() {
  const { t } = useT();
  const me = trpc.auth.me.useQuery();
  const workspaces = trpc.org.myWorkspaces.useQuery();
  const switchWs = trpc.org.switchWorkspace.useMutation({
    onSuccess: () => window.location.assign("/"),
  });

  const current = me.data?.activeOrganization?.publicId ?? "";
  const name = me.data?.activeOrganization?.name ?? t("workspace.personal");
  const type = me.data?.activeOrganization?.type;
  const dot = type === "team" ? "bg-gold" : "bg-navy-600";

  if (!workspaces.data || workspaces.data.length <= 1) {
    return (
      <div className="flex items-center gap-2 rounded-xl bg-navy/5 px-3 py-1.5">
        <span className={`h-2 w-2 rounded-full ${dot}`} />
        <span className="text-sm font-medium text-navy-900">{name}</span>
      </div>
    );
  }

  return (
    <div className="relative flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-1.5 transition hover:bg-gray-50">
      <span className={`h-2 w-2 rounded-full ${dot}`} />
      <select
        value={current}
        onChange={(e) => switchWs.mutate({ organizationPublicId: e.target.value })}
        className="appearance-none bg-transparent pr-5 text-sm font-medium text-navy-900 outline-none"
      >
        {workspaces.data.map((w) => (
          <option key={w.publicId} value={w.publicId}>
            {w.name}
          </option>
        ))}
      </select>
      <ChevronsUpDown className="pointer-events-none absolute right-2.5 h-3.5 w-3.5 text-ink/40" />
    </div>
  );
}
