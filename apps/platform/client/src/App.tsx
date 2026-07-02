import { Redirect, Route, Switch } from "wouter";
import { trpc } from "./lib/trpc";
import { Layout } from "./components/Layout";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";

export default function App() {
  const me = trpc.auth.me.useQuery();

  if (me.isLoading) {
    return (
      <div className="flex h-full items-center justify-center text-navy">
        <span className="animate-pulse text-lg">Loading Pleyad…</span>
      </div>
    );
  }

  const authed = Boolean(me.data);

  return (
    <Switch>
      <Route path="/login">{authed ? <Redirect to="/" /> : <Login />}</Route>
      <Route path="/register">{authed ? <Redirect to="/" /> : <Register />}</Route>
      <Route path="/">
        {authed ? (
          <Layout>
            <Dashboard />
          </Layout>
        ) : (
          <Redirect to="/login" />
        )}
      </Route>
      <Route>
        <Redirect to="/" />
      </Route>
    </Switch>
  );
}
