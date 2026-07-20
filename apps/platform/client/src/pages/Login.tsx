import { useState } from "react";
import { Link, useLocation } from "wouter";
import { trpc } from "../lib/trpc";
import { useT } from "../lib/i18n";
import { AuthShell } from "../components/AuthShell";
import { Button, Field } from "../components/ui";

export default function Login() {
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const { t } = useT();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const login = trpc.auth.login.useMutation({
    onSuccess: async () => {
      await utils.auth.me.invalidate();
      navigate("/");
    },
  });

  return (
    <AuthShell
      title={t("auth.welcomeTitle")}
      subtitle={t("auth.welcomeSubtitle")}
      footer={
        <>
          {t("auth.noAccount")}{" "}
          <Link to="/register" className="font-semibold text-navy underline">
            {t("auth.createOne")}
          </Link>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          login.mutate({ email, password });
        }}
      >
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
        />
        {login.error && <p className="text-sm text-red-600">{login.error.message}</p>}
        <Button type="submit" className="w-full" disabled={login.isPending}>
          {login.isPending ? t("auth.signingIn") : t("auth.signIn")}
        </Button>
      </form>
    </AuthShell>
  );
}
