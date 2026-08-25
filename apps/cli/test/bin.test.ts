import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { parse } from 'yaml'
import { runCli, type CliDependencies, type CliIO } from '../src/bin.js'

const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((path) => rm(path, { force: true, recursive: true })),
  )
})

function captureIO(): { errors: string[]; io: CliIO; output: string[] } {
  const errors: string[] = []
  const output: string[] = []
  return {
    errors,
    io: {
      stderr: (text) => errors.push(text),
      stdout: (text) => output.push(text),
    },
    output,
  }
}

describe('star-employee recipe validate', () => {
  it('validates the checked-in example', async () => {
    const { errors, io, output } = captureIO()
    const code = await runCli(
      ['recipe', 'validate', 'recipes/examples/research-analyst.yaml'],
      io,
    )

    expect(code).toBe(0)
    expect(errors).toEqual([])
    expect(output.join('')).toBe(
      'Valid Employee recipe: research-analyst (star.employee/v1alpha1)\n',
    )
  })

  it('reports malformed YAML without a stack trace', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'star-employee-'))
    temporaryDirectories.push(directory)
    const path = join(directory, 'invalid.yaml')
    await writeFile(path, 'apiVersion: [unterminated', 'utf8')
    const { errors, io, output } = captureIO()

    const code = await runCli(['recipe', 'validate', path], io)

    expect(code).toBe(1)
    expect(output).toEqual([])
    expect(errors.join('')).toContain('Unable to parse recipe')
    expect(errors.join('')).not.toMatch(/\n\s+at \S/)
  })

  it('reports schema errors and returns a failure code', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'star-employee-'))
    temporaryDirectories.push(directory)
    const path = join(directory, 'invalid.yaml')
    await writeFile(
      path,
      'apiVersion: star.employee/v1alpha1\nkind: Employee\nmetadata:\n  name: invalid\n  apiKey: no\nspec: {}\n',
      'utf8',
    )
    const { errors, io } = captureIO()

    const code = await runCli(['recipe', 'validate', path], io)

    expect(code).toBe(1)
    expect(errors.join('')).toContain('Invalid Employee recipe')
    expect(errors.join('')).toContain('/metadata/apiKey: unknown field "apiKey"')
  })
})

describe('star-employee recipe compile', () => {
  it('writes locked capability inputs without mutating the source recipe', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'star-employee-'))
    temporaryDirectories.push(directory)
    const source = await readFile('recipes/examples/research-analyst.yaml', 'utf8')
    const recipe = parse(source) as { spec: { plugins?: unknown; skills?: unknown } }
    delete recipe.spec.plugins
    recipe.spec.skills = [
      { name: 'env-report', source: { path: 'capability', type: 'local' } },
    ]
    const skillDirectory = join(directory, 'capability', 'skills', 'env-report')
    await mkdir(skillDirectory, { recursive: true })
    await writeFile(
      join(skillDirectory, 'SKILL.md'),
      '---\nname: env-report\ndescription: Reports fixture environment data.\n---\n',
      'utf8',
    )
    const path = join(directory, 'employee.json')
    const outputPath = join(directory, 'compiled')
    await writeFile(path, `${JSON.stringify(recipe, null, 2)}\n`, 'utf8')
    const { errors, io, output } = captureIO()
    const compileCapabilities = vi.fn(async (options) => ({
      lock: {
        skillRoot: { digest: `sha256:${'a'.repeat(64)}` },
      },
      outputDirectory: options.outputDirectory,
    })) as unknown as CliDependencies['compileCapabilities']

    const code = await runCli(
      ['recipe', 'compile', path, '--output', outputPath],
      io,
      { compileCapabilities },
    )

    expect(code).toBe(0)
    expect(errors).toEqual([])
    expect(output.join('')).toContain('Compiled capabilities: research-analyst')
    expect(compileCapabilities).toHaveBeenCalledWith(
      expect.objectContaining({ outputDirectory: outputPath }),
    )
  })
})
