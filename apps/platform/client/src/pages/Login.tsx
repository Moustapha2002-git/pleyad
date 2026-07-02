import { useState } from "react";
import { Link, useLocation } from "wouter";
import { trpc } from "../lib/trpc";
import { AuthShell } from "../components/AuthShell";
import { Button, Field } from "../components/ui";

export default function Login() {
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
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
      title="Welcome back"
      subtitle="Sign in to your Pleyad space"
      footer={
        <>
          No account?{" "}
          <Link to="/register" className="font-medium text-navy underline">
            Create one
          </Link>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          login.mutate({ email, password });
        }}
      >
        <Field
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <Field
          label="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {login.error && <p className="mb-3 text-sm text-red-600">{login.error.message}</p>}
        <Button type="submit" disabled={login.isPending}>
          {login.isPending ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </AuthShell>
  );
}
