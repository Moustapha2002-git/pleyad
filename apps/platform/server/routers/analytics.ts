import { analyticsRepo, db } from "@pleyad/db";
import { adminProcedure, router } from "../trpc";

export const analyticsRouter = router({
  /** Org-wide cohort overview: dimension averages, completion funnel, at-risk learners. */
  cohort: adminProcedure.query(({ ctx }) =>
    analyticsRepo.getCohortOverview(db, ctx.tenant.organizationId),
  ),
});
