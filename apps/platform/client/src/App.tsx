import { Redirect, Route, Switch } from "wouter";
import { trpc } from "./lib/trpc";
import { AppShell } from "./components/AppShell";
import { Spinner } from "./components/ui";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Paths from "./pages/Paths";
import PathDetail from "./pages/PathDetail";
import MentorLearners from "./pages/MentorLearners";
import LearnerProfile from "./pages/LearnerProfile";
import Mentoring from "./pages/Mentoring";

export default function App() {
  const me = trpc.auth.me.useQuery();

  if (me.isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner label="Loading Pleyad…" />
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
    <AppShell>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/paths" component={Paths} />
        <Route path="/paths/:id">{(params) => <PathDetail id={Number(params.id)} />}</Route>
        <Route path="/mentor" component={MentorLearners} />
        <Route path="/mentor/:learnerId">
          {(params) => <LearnerProfile learnerId={Number(params.learnerId)} />}
        </Route>
        <Route path="/mentoring" component={Mentoring} />
        <Route>
          <Redirect to="/" />
        </Route>
      </Switch>
    </AppShell>
  );
}
