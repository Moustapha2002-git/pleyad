import type { DB } from "../client";

/**
 * The tenant context resolved from the session on EVERY request — server-side,
 * never from client input. Tenant-scoped repositories require this object, so a
 * cross-tenant query is impossible to write without deliberately bypassing the
 * repository layer. This is the seam that makes tenant isolation structural
 * rather than a matter of per-query discipline (docs/adr/0001).
 */
export interface TenantContext {
  db: DB;
  organizationId: number;
  userId: number;
  role: "owner" | "admin" | "manager" | "mentor" | "member";
}
