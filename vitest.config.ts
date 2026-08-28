import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@star/employee-compiler': fileURLToPath(
        new URL('./packages/compiler/src/index.ts', import.meta.url),
      ),
      '@star/employee-contracts': fileURLToPath(
        new URL('./packages/contracts/src/index.ts', import.meta.url),
      ),
      '@star/employee-bridge': fileURLToPath(
        new URL('./packages/bridge/src/index.ts', import.meta.url),
      ),
      '@star/employee-ledger': fileURLToPath(
        new URL('./packages/ledger/src/index.ts', import.meta.url),
      ),
      '@star/employee-supervisor': fileURLToPath(
        new URL('./packages/supervisor/src/index.ts', import.meta.url),
      ),
      '@star/employee-connector': fileURLToPath(
        new URL('./packages/connector/src/index.ts', import.meta.url),
      ),
      '@star/employee-gateway': fileURLToPath(
        new URL('./packages/gateway/src/index.ts', import.meta.url),
      ),
      '@star/employee-workspace': fileURLToPath(
        new URL('./packages/workspace/src/index.ts', import.meta.url),
      ),
      '@star/employee-workflow': fileURLToPath(
        new URL('./packages/workflow/src/index.ts', import.meta.url),
      ),
      '@star/employee-verifier': fileURLToPath(
        new URL('./packages/verifier/src/index.ts', import.meta.url),
      ),
    },
  },
  test: {
    coverage: {
      enabled: false,
    },
  },
})
