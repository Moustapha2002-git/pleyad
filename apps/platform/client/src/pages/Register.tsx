import { useState } from "react";
import { Link, useLocation } from "wouter";
import { trpc } from "../lib/trpc";
import { AuthShell } from "../components/AuthShell";
import { Button, Field } from "../components/ui";

export default function Register() {
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const register = trpc.auth.register.useMutation({
    onSuccess: async () => {
      await utils.auth.me.invalidate();
      navigate("/");
    },
  });

  return (
    <AuthShell
      title="Create your space"
      subtitle="Start centralizing your learning in one place"
      footer={
        <>
          Already have an account?{" "}
          <Link to="/login" className="font-semibold text-navy underline">
            Sign in
          </Link>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          register.mutate({ name, email, password });
        }}
      >
        <Field
          label="Full name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
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
          minLength={8}
        />
        {register.error && <p className="text-sm text-red-600">{register.error.message}</p>}
        <Button type="submit" className="w-full" disabled={register.isPending}>
          {register.isPending ? "Creating…" : "Create my space"}
        </Button>
      </form>
    </AuthShell>
  );
}
