/**
 * Smoke test for cohort analytics (dev only). Seeds the Innovation Academy demo
 * (2 learners + assigned paths + some progress), promotes the caller to admin,
 * then exercises analytics.cohort through the real router/tenancy stack.
 *
 * Run:  npx tsx server/analytics-smoke.ts
 */
import "dotenv/config";
import { db, organizationsRepo, usersRepo } from "@pleyad/db";
import { createContext } from "./context";
import { appRouter } from "./routers";
import { ACTIVE_ORG_COOKIE, SESSION_COOKIE } from "./auth/cookies";

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
  const email = `analytics+${Date.now()}@pleyad.test`;

  // 1) Register → session
  const m1 = mockRes();
  const anon = appRouter.createCaller(await ctxFor("", m1.res));
  await anon.auth.register({ name: "Analytics Admin", email, password: "supersecret123" });
  const token = m1.store[SESSION_COOKIE]!;

  // 2) Seed the demo cohort (joins Innovation Academy, assigns paths, some progress)
  const m2 = mockRes();
  const authed = appRouter.createCaller(await ctxFor(`${SESSION_COOKIE}=${token}`, m2.res));
  const demo = await authed.dev.setupMentorDemo();
  const orgCookie = m2.store[ACTIVE_ORG_COOKIE]!;
  console.log("seeded:", demo.workspace, "| learners:", demo.learners.map((l) => l.name).join(", "));

  // 3) Promote this user to admin in Innovation Academy
  const ia = await organizationsRepo.getOrganizationBySlug(db, "innovation-academy");
  const user = await usersRepo.getUserByEmail(db, email);
  await organizationsRepo.setMembershipRole(db, user!.id, ia!.id, "admin");

  // 4) Call analytics.cohort as admin in that workspace
  const m3 = mockRes();
  const admin = appRouter.createCaller(
    await ctxFor(`${SESSION_COOKIE}=${token}; ${ACTIVE_ORG_COOKIE}=${orgCookie}`, m3.res),
  );
  const me = await admin.auth.me();
  console.log(`acting as: ${me?.activeOrganization?.role} in ${me?.activeOrganization?.name}\n`);

  const overview = await admin.analytics.cohort();
  console.dir(overview, { depth: null });

  // Sanity assertions
  const ok =
    overview.totals.learners >= 2 &&
    overview.dimensions.length === 3 &&
    overview.funnel.total === overview.totals.assignedPaths &&
    overview.funnel.notStarted + overview.funnel.inProgress + overview.funnel.completed ===
      overview.funnel.total;
  if (!ok) throw new Error("Assertions failed — numbers are inconsistent");

  console.log("\n✓ ANALYTICS SMOKE PASSED — cohort overview is consistent and populated.");
  process.exit(0);
}

main().catch((e) => {
  console.error("ANALYTICS SMOKE FAILED:", e);
  process.exit(1);
});
