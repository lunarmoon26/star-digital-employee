import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { CapabilityLockSchema } from '../src/capability-lock.js'
import { EmployeeRecipeSchema } from '../src/employee-recipe.js'

const schemas = [
  {
    name: 'Employee recipe',
    target: fileURLToPath(
      new URL('../../../schemas/employee-recipe.v1alpha1.schema.json', import.meta.url),
    ),
    value: EmployeeRecipeSchema,
  },
  {
    name: 'Capability lock',
    target: fileURLToPath(
      new URL('../../../schemas/capability-lock.v1alpha1.schema.json', import.meta.url),
    ),
    value: CapabilityLockSchema,
  },
]

async function main(): Promise<void> {
  if (process.argv.includes('--write')) {
    for (const schema of schemas) {
      await writeFile(schema.target, `${JSON.stringify(schema.value, null, 2)}\n`, 'utf8')
      process.stdout.write(`Generated ${schema.target}\n`)
    }
    return
  }

  if (process.argv.includes('--check')) {
    for (const schema of schemas) {
      let actual: string
      try {
        actual = await readFile(schema.target, 'utf8')
      } catch {
        process.stderr.write(
          `Generated ${schema.name} schema is missing. Run pnpm schema:generate.\n`,
        )
        process.exitCode = 1
        return
      }

      const expected = `${JSON.stringify(schema.value, null, 2)}\n`
      if (actual !== expected) {
        process.stderr.write(
          `Generated ${schema.name} schema is stale. Run pnpm schema:generate.\n`,
        )
        process.exitCode = 1
        return
      }
    }

    process.stdout.write(`Generated schemas are current (${schemas.length}).\n`)
    return
  }

  process.stderr.write('Usage: schema.ts --write | --check\n')
  process.exitCode = 2
}

await main()
