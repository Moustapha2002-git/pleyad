/**
 * Deterministic Jitsi room name for a mentor↔learner pair, so both sides join the
 * same call. Order-independent (sorted ids) and scoped to the workspace.
 */
export function callRoomName(orgPublicId: string, userA: number, userB: number) {
  const [lo, hi] = userA < userB ? [userA, userB] : [userB, userA];
  return `pleyad-${orgPublicId}-${lo}-${hi}`;
}
