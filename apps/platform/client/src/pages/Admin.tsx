import { useState } from "react";
import { KeyRound, UserPlus } from "lucide-react";
import { trpc } from "../lib/trpc";
import { useToast } from "../components/Toast";
import { Avatar, Badge, Button, Card, PageHeader, Select, Spinner, TextInput } from "../components/ui";

type Role = "member" | "mentor" | "admin";
const ROLE_LABEL: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  manager: "Manager",
  mentor: "Mentor",
  member: "Learner",
};

export default function Admin() {
  const me = trpc.auth.me.useQuery();
  const members = trpc.admin.members.useQuery();
  const utils = trpc.useUtils();
  const toast = useToast();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("member");
  const [created, setCreated] = useState<{ email: string; tempPassword: string } | null>(null);

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

  const orgName = me.data?.activeOrganization?.name ?? "Workspace";
  const all = members.data ?? [];
  const mentors = all.filter((m) => ["mentor", "admin", "owner"].includes(m.role));

  return (
    <div className="space-y-6">
      <PageHeader title="Admin" subtitle={`Manage members of ${orgName}`} />

      {/* Add member */}
      <Card className="p-6">
        <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-navy-900">
          <UserPlus className="h-4 w-4" /> Add a member
        </h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim() && email.trim()) addMember.mutate({ name: name.trim(), email: email.trim(), role });
          }}
          className="flex flex-col gap-3 sm:flex-row"
        >
          <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" className="sm:flex-1" />
          <TextInput type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="sm:flex-1" />
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
              <p className="font-semibold text-navy-900">
                Account created for {created.email}
              </p>
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

      {/* Members */}
      <Card className="p-2">
        {members.isLoading ? (
          <div className="p-4">
            <Spinner label="Loading members…" />
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {all.map((m) => {
              const isLearner = m.role === "member";
              const selfOwner = m.role === "owner";
              return (
                <div key={m.userId} className="flex flex-wrap items-center gap-3 p-3">
                  <Avatar name={m.name ?? m.email ?? "?"} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-navy-900">{m.name ?? m.email}</div>
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
                            unassignMentor.mutate({ learnerUserId: m.userId, mentorUserId: m.mentorUserId });
                        } else {
                          assignMentor.mutate({ learnerUserId: m.userId, mentorUserId: Number(val) });
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

                  {!isLearner && !selfOwner && (
                    <Badge>{ROLE_LABEL[m.role] ?? m.role}</Badge>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
