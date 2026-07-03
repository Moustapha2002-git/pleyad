/**
 * In-memory call signaling (ephemeral). Holds at most one pending incoming call
 * per user, keyed by callee. Call state is inherently short-lived, so an in-memory
 * store is appropriate for a single-instance server; a production multi-instance
 * deployment would move this to Redis or a WebSocket gateway.
 */
export interface CallInvite {
  fromUserId: number;
  fromName: string;
  toUserId: number;
  organizationId: number;
  room: string;
  createdAt: number;
}

const TTL_MS = 45_000; // a ring expires after 45s
const invites = new Map<number, CallInvite>();

export function ring(invite: Omit<CallInvite, "createdAt">) {
  invites.set(invite.toUserId, { ...invite, createdAt: Date.now() });
}

export function getIncoming(toUserId: number, organizationId: number): CallInvite | null {
  const inv = invites.get(toUserId);
  if (!inv) return null;
  if (Date.now() - inv.createdAt > TTL_MS) {
    invites.delete(toUserId);
    return null;
  }
  // Only surface calls within the user's active workspace.
  if (inv.organizationId !== organizationId) return null;
  return inv;
}

export function clearIncoming(toUserId: number) {
  invites.delete(toUserId);
}

/** Caller cancels a ring they started (only clears if they are the caller). */
export function cancelFrom(fromUserId: number, toUserId: number) {
  const inv = invites.get(toUserId);
  if (inv && inv.fromUserId === fromUserId) invites.delete(toUserId);
}
