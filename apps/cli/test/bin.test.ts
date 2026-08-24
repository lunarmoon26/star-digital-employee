import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { runCli, type CliIO } from '../src/bin.js'

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
