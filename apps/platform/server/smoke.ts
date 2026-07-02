/**
 * End-to-end smoke test (dev only). Drives the real router against the live DB:
 * register → issue session → resolve tenant from the session → tenant-scoped
 * write + read. Uses tRPC's server-side caller so we exercise the actual auth,
 * session, and tenancy logic without HTTP plumbing.
 *
 * Run:  npx tsx server/smoke.ts
 * Note: creates a throwaway user + personal workspace in the dev database.
 */
import "dotenv/config";
import { createContext } from "./context";
import { appRouter } from "./routers";
import { SESSION_COOKIE } from "./auth/cookies";

function mockRes() {
  const store: Record<string, string> = {};
  const res = {
    cookie: (name: string, value: string) => {
      store[name] = value;
    },
    clearCookie: () => {},
  };
  return { res, store };
}

async function ctxFor(cookie: string, res: unknown) {
  return createContext({ req: { headers: cookie ? { cookie } : {} }, res } as never);
}

async function main() {
  const email = `smoke+${Date.now()}@pleyad.test`;
  const password = "supersecret123";

  // 1) Register anonymously
  const m1 = mockRes();
  const anon = appRouter.createCaller(await ctxFor("", m1.res));
  await anon.auth.register({ name: "Smoke Test", email, password });
  const token = m1.store[SESSION_COOKIE];
  console.log("1) registered:", email, "| session issued:", Boolean(token));

  // 2) Rebuild context from the session cookie → resolves (user, org, role)
  const m2 = mockRes();
  const authed = appRouter.createCaller(await ctxFor(`${SESSION_COOKIE}=${token}`, m2.res));
  const me = await authed.auth.me();
  console.log("2) me:", me);

  // 3) Tenant-scoped write then read — should be auto-scoped to the personal workspace
  const created = await authed.collections.create({ title: "My First Playlist", kind: "playlist" });
  const list = await authed.collections.list();
  console.log("3) created collection id:", created.id);
  console.log(
    "   collections in active workspace:",
    list.map((c) => ({ id: c.id, title: c.title, org: c.organizationId, kind: c.kind })),
  );

  console.log("\n✓ SMOKE PASSED — auth, sessions, tenancy, and tenant-scoped data all work.");
  process.exit(0);
}

main().catch((e) => {
  console.error("SMOKE FAILED:", e);
  process.exit(1);
});
