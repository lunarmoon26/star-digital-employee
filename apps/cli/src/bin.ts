#!/usr/bin/env node

import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import {
  formatRecipeIssues,
  validateEmployeeRecipe,
} from '@star/employee-contracts'
import { Command, CommanderError } from 'commander'
import { parse } from 'yaml'

export interface CliIO {
  stderr: (text: string) => void
  stdout: (text: string) => void
}

const processIO: CliIO = {
  stderr: (text) => process.stderr.write(text),
  stdout: (text) => process.stdout.write(text),
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

async function validateRecipeFile(path: string, io: CliIO): Promise<boolean> {
  let source: string
  try {
    source = await readFile(path, 'utf8')
  } catch (error) {
    io.stderr(`Unable to read recipe "${path}": ${errorMessage(error)}\n`)
    return false
  }

  let candidate: unknown
  try {
    candidate = parse(source)
  } catch (error) {
    io.stderr(`Unable to parse recipe "${path}": ${errorMessage(error)}\n`)
    return false
  }

  const result = validateEmployeeRecipe(candidate)
  if (!result.ok) {
    io.stderr(`Invalid Employee recipe: ${path}\n${formatRecipeIssues(result.issues)}\n`)
    return false
  }

  io.stdout(
    `Valid Employee recipe: ${result.value.metadata.name} (${result.value.apiVersion})\n`,
  )
  return true
}

export async function runCli(argv: string[], io: CliIO = processIO): Promise<number> {
  let exitCode = 0
  const program = new Command()
    .name('star-employee')
    .description('Build and operate infrastructure-as-code digital employees')
    .version('0.1.0')
    .configureOutput({
      writeErr: io.stderr,
      writeOut: io.stdout,
    })
    .exitOverride()

  const recipe = program.command('recipe').description('Work with Employee recipes')

  recipe
    .command('validate')
    .description('Validate a YAML or JSON Employee recipe')
    .argument('<path>', 'path to the recipe')
    .action(async (path: string) => {
      if (!(await validateRecipeFile(resolve(path), io))) exitCode = 1
    })

  try {
    await program.parseAsync(argv, { from: 'user' })
  } catch (error) {
    if (error instanceof CommanderError) return error.exitCode
    throw error
  }

  return exitCode
}

const entrypoint = process.argv[1]
if (entrypoint && pathToFileURL(resolve(entrypoint)).href === import.meta.url) {
  process.exitCode = await runCli(process.argv.slice(2))
}
