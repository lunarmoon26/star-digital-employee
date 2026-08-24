# Generated Schemas

Files in this directory are generated distribution artifacts. The typed source for
the Employee recipe is `packages/contracts/src/employee-recipe.ts`.

The JSON Schema owns structural syntax and constraints that JSON Schema can express.
The CLI additionally enforces cross-field invariants: the default execution profile
exists, automatically allowed and approval-gated tools do not overlap, package
requirements are unique by name. Environment values are never inline. `v1alpha1`
allows only `LOG_LEVEL`, `TZ`, `LANG`, and `NO_COLOR`, resolved through named
non-secret configuration references. The runtime resolver remains responsible for
proving the referenced configuration source is classified as non-secret.

Regenerate and verify with:

```bash
pnpm schema:generate
pnpm schema:check
```
