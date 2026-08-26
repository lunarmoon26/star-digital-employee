/**
 * Deterministic inbound routing (architecture "Critical Flow: Channel Message"
 * step 3). One routing key maps to one bridge-owned DSH session, so a channel
 * thread resumes the same conversation across restarts.
 */

/**
 * Build the canonical routing key for an envelope. A thread groups one
 * conversation; without a thread, the sender becomes the direct-message thread;
 * with neither, the key falls back to a single `direct` conversation.
 */
export function canonicalRouteKey(
  channel: string,
  account: string,
  thread?: string,
  sender?: string,
): string {
  const scope = thread ?? sender ?? 'direct'
  return `${channel}\u0000${account}\u0000${scope}`
}
