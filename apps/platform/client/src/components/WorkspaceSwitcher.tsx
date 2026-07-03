import { trpc } from "../lib/trpc";

export function WorkspaceSwitcher() {
  const me = trpc.auth.me.useQuery();
  const workspaces = trpc.org.myWorkspaces.useQuery();
  const switchWs = trpc.org.switchWorkspace.useMutation({
    onSuccess: () => window.location.assign("/"),
  });

  const current = me.data?.activeOrganization?.publicId ?? "";
  const name = me.data?.activeOrganization?.name ?? "Personal workspace";

  if (!workspaces.data || workspaces.data.length <= 1) {
    return (
      <span className="rounded-full bg-navy/5 px-3 py-1 text-sm text-navy/70">{name}</span>
    );
  }

  return (
    <select
      value={current}
      onChange={(e) => switchWs.mutate({ organizationPublicId: e.target.value })}
      className="rounded-full border border-gray-300 bg-white px-3 py-1 text-sm text-navy"
    >
      {workspaces.data.map((w) => (
        <option key={w.publicId} value={w.publicId}>
          {w.name}
          {w.type === "personal" ? " (personal)" : ""}
        </option>
      ))}
    </select>
  );
}
