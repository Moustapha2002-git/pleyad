import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { db } from "@pleyad/db";
import type { TenantContext } from "@pleyad/db";
import type { Context } from "./context";

const t = initTRPC.context<Context>().create({ transformer: superjson });

export const router = t.router;

/** Open to anyone. */
export const publicProcedure = t.procedure;

/** Requires an authenticated user. */
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});

/**
 * Requires an authenticated user WITH an active workspace, and exposes the
 * `TenantContext` that every tenant-scoped repository requires. Any query run via
 * `ctx.tenant` is automatically scoped to the resolved organization.
 */
export const tenantProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (!ctx.tenant) {
    throw new TRPCError({ code: "FORBIDDEN", message: "No active workspace" });
  }
  const tenant: TenantContext = {
    db,
    organizationId: ctx.tenant.organizationId,
    userId: ctx.user.id,
    role: ctx.tenant.role,
  };
  return next({ ctx: { ...ctx, tenant } });
});
