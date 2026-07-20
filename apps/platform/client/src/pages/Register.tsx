import { useState } from "react";
import { Building2 } from "lucide-react";
import { Link, useLocation } from "wouter";
import { trpc } from "../lib/trpc";
import { useT } from "../lib/i18n";
import { AuthShell } from "../components/AuthShell";
import { Button, Field } from "../components/ui";

export default function Register() {
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const { t } = useT();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Invite links land here as /register?invite=TOKEN
  const [inviteToken] = useState(
    () => new URLSearchParams(window.location.search).get("invite") ?? undefined,
  );
  const invite = trpc.invites.info.useQuery(
    { token: inviteToken ?? "" },
    { enabled: Boolean(inviteToken) },
  );

  const register = trpc.auth.register.useMutation({
    onSuccess: async () => {
      await utils.auth.me.invalidate();
      navigate("/");
    },
  });

  const joining = inviteToken && invite.data ? invite.data : null;

  return (
    <AuthShell
      title={joining ? t("auth.joinTitle", { org: joining.organizationName }) : t("auth.createTitle")}
      subtitle={
        joining
          ? t("auth.joinSubtitle", { role: joining.roleLabel.toLowerCase() })
          : t("auth.createSubtitle")
      }
      footer={
        <>
          {t("auth.haveAccount")}{" "}
          <Link to="/login" className="font-semibold text-navy underline">
            {t("auth.signInLink")}
          </Link>
        </>
      }
    >
      {joining && (
        <div className="mb-6 flex items-center gap-3 rounded-xl border border-gold/40 bg-gold/10 p-4">
          <Building2 className="h-5 w-5 shrink-0 text-gold" />
          <p className="text-sm text-ink/80">
            {t("auth.joinBanner", { org: joining.organizationName, role: joining.roleLabel })}
          </p>
        </div>
      )}
      {inviteToken && invite.data === null && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {t("auth.inviteInvalid")}
        </div>
      )}

      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          register.mutate({
            name,
            email,
            password,
            inviteToken: joining ? inviteToken : undefined,
          });
        }}
      >
        <Field
          label={t("auth.fullName")}
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <Field
          label={t("auth.email")}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <Field
          label={t("auth.password")}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
        />
        {register.error && <p className="text-sm text-red-600">{register.error.message}</p>}
        <Button type="submit" className="w-full" disabled={register.isPending}>
          {register.isPending
            ? t("auth.creating")
            : joining
              ? t("auth.join", { org: joining.organizationName })
              : t("auth.createMySpace")}
        </Button>
      </form>
    </AuthShell>
  );
}
