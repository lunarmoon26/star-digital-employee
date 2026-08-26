/**
 * Effect policy: which external mutations must clear a human approval before
 * the gateway dispatches them. The recipe's `tools.requireApproval` list is the
 * source of truth; the `tools.allow` list is enforced at recipe validation and
 * does not need to be re-checked here.
 */

export interface EffectPolicy {
  /** Targets that require approval before dispatch. */
  readonly requireApproval: ReadonlySet<string>
}

/** Derive gateway policy from a recipe's tool policy. */
export function policyFromRecipe(tools: { requireApproval: readonly string[] }): EffectPolicy {
  return { requireApproval: new Set(tools.requireApproval) }
}
