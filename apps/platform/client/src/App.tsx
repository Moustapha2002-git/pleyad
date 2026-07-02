import { Redirect, Route, Switch } from "wouter";
import { trpc } from "./lib/trpc";
import { Layout } from "./components/Layout";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Paths from "./pages/Paths";
import PathDetail from "./pages/PathDetail";

export default function App() {
  const me = trpc.auth.me.useQuery();

  if (me.isLoading) {
    return (
      <div className="flex h-full items-center justify-center text-navy">
        <span className="animate-pulse text-lg">Loading Pleyad…</span>
      </div>
    );
  }

  if (!me.data) {
    return (
      <Switch>
        <Route path="/register" component={Register} />
        <Route path="/login" component={Login} />
        <Route>
          <Redirect to="/login" />
        </Route>
      </Switch>
    );
  }

  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/paths" component={Paths} />
        <Route path="/paths/:id">{(params) => <PathDetail id={Number(params.id)} />}</Route>
        <Route>
          <Redirect to="/" />
        </Route>
      </Switch>
    </Layout>
  );
}
