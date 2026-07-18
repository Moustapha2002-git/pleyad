import { Redirect, Route, Switch } from "wouter";
import { trpc } from "./lib/trpc";
import { AppShell } from "./components/AppShell";
import { Spinner } from "./components/ui";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Paths from "./pages/Paths";
import PathDetail from "./pages/PathDetail";
import PlaylistDetail from "./pages/PlaylistDetail";
import LearnWorkspace from "./pages/LearnWorkspace";
import MentorLearners from "./pages/MentorLearners";
import LearnerProfile from "./pages/LearnerProfile";
import Mentoring from "./pages/Mentoring";
import Admin from "./pages/Admin";
import AdminLearners from "./pages/AdminLearners";
import AdminPaths from "./pages/AdminPaths";
import Analytics from "./pages/Analytics";
import Schedule from "./pages/Schedule";
import Settings from "./pages/Settings";

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

  // Strict role separation: each role gets only its own routes; everything
  // else redirects to that role's home. (Servers guard the data regardless.)
  const role = me.data.activeOrganization?.role;
  const inTeam = me.data.activeOrganization?.type === "team";
  const isAdmin = inTeam && (role === "admin" || role === "owner");
  const isMentor = inTeam && (role === "mentor" || role === "manager");
  const isLearner = !isAdmin && !isMentor; // team members + personal workspaces
  const home = isAdmin ? "/admin" : isMentor ? "/mentor" : "/";

  return (
    <AppShell>
      <Switch>
        {/* Learner world */}
        {isLearner && <Route path="/" component={Dashboard} />}
        {isLearner && <Route path="/mentoring" component={Mentoring} />}
        {isLearner && (
          <Route path="/playlists/:id">
            {(params) => <PlaylistDetail id={Number(params.id)} />}
          </Route>
        )}
        {isLearner && (
          <Route path="/playlists/:id/learn/:rid">
            {(params) => (
              <LearnWorkspace
                kind="playlist"
                id={Number(params.id)}
                resourceId={Number(params.rid)}
              />
            )}
          </Route>
        )}

        {/* Learners learn on paths; mentors author them; admins get the catalog */}
        {(isLearner || isMentor) && <Route path="/paths" component={Paths} />}
        {isAdmin && <Route path="/paths" component={AdminPaths} />}
        <Route path="/paths/:id">{(params) => <PathDetail id={Number(params.id)} />}</Route>
        <Route path="/paths/:id/learn/:rid">
          {(params) => (
            <LearnWorkspace kind="path" id={Number(params.id)} resourceId={Number(params.rid)} />
          )}
        </Route>
        {(isLearner || isMentor) && <Route path="/schedule" component={Schedule} />}

        {/* Mentor world (admins keep the learner-profile drill-through for oversight) */}
        {isMentor && <Route path="/mentor" component={MentorLearners} />}
        {(isMentor || isAdmin) && (
          <Route path="/mentor/:learnerId">
            {(params) => <LearnerProfile learnerId={Number(params.learnerId)} />}
          </Route>
        )}

        {/* Admin world */}
        {isAdmin && <Route path="/learners" component={AdminLearners} />}
        {isAdmin && <Route path="/analytics" component={Analytics} />}
        {isAdmin && <Route path="/admin" component={Admin} />}

        {/* Account-level, any role */}
        <Route path="/settings" component={Settings} />

        <Route>
          <Redirect to={home} />
        </Route>
      </Switch>
    </AppShell>
  );
}
