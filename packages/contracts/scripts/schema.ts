import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { EmployeeRecipeSchema } from '../src/employee-recipe.js'

const target = fileURLToPath(
  new URL('../../../schemas/employee-recipe.v1alpha1.schema.json', import.meta.url),
)
const expected = `${JSON.stringify(EmployeeRecipeSchema, null, 2)}\n`

async function main(): Promise<void> {
  if (process.argv.includes('--write')) {
    await writeFile(target, expected, 'utf8')
    process.stdout.write(`Generated ${target}\n`)
    return
  }

  if (process.argv.includes('--check')) {
    let actual: string
    try {
      actual = await readFile(target, 'utf8')
    } catch {
      process.stderr.write(
        'Generated Employee recipe schema is missing. Run pnpm schema:generate.\n',
      )
      process.exitCode = 1
      return
    }

    if (actual !== expected) {
      process.stderr.write(
        'Generated Employee recipe schema is stale. Run pnpm schema:generate.\n',
      )
      process.exitCode = 1
      return
    }

    process.stdout.write('Employee recipe schema is current.\n')
    return
  }

  process.stderr.write('Usage: schema.ts --write | --check\n')
  process.exitCode = 2
}

await main()
