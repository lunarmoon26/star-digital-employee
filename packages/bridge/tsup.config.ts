import { defineConfig } from 'tsup'

// The plugin is the deployment artifact: one self-contained ESM file with only
// Node builtins at runtime, so the compiler can copy it into the immutable tree
// and address it by absolute path. The library entry is built separately for
// a future supervisor-side client; the two entries must not share chunks.
export default defineConfig([
  {
    entry: { plugin: 'src/plugin.ts' },
    format: ['esm'],
    platform: 'node',
    splitting: false,
    outExtension: () => ({ js: '.mjs' }),
    dts: true,
    clean: true,
  },
  {
    entry: { index: 'src/index.ts' },
    format: ['esm'],
    platform: 'node',
    splitting: false,
    dts: true,
    clean: false,
  },
])
