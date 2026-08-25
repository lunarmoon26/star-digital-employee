#!/usr/bin/env node

import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { compileCapabilities as compileEmployeeCapabilities } from '@star/employee-compiler'
import {
  formatRecipeIssues,
  validateEmployeeRecipe,
  type EmployeeRecipe,
} from '@star/employee-contracts'
import { Command, CommanderError } from 'commander'
import { parse } from 'yaml'

export interface CliIO {
  stderr: (text: string) => void
  stdout: (text: string) => void
}

export interface CliDependencies {
  compileCapabilities: typeof compileEmployeeCapabilities
}

const processIO: CliIO = {
  stderr: (text) => process.stderr.write(text),
  stdout: (text) => process.stdout.write(text),
}

const processDependencies: CliDependencies = {
  compileCapabilities: compileEmployeeCapabilities,
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

async function readRecipeFile(path: string, io: CliIO): Promise<EmployeeRecipe | undefined> {
  let source: string
  try {
    source = await readFile(path, 'utf8')
  } catch (error) {
    io.stderr(`Unable to read recipe "${path}": ${errorMessage(error)}\n`)
    return undefined
  }

  let candidate: unknown
  try {
    candidate = parse(source)
  } catch (error) {
    io.stderr(`Unable to parse recipe "${path}": ${errorMessage(error)}\n`)
    return undefined
  }

  const result = validateEmployeeRecipe(candidate)
  if (!result.ok) {
    io.stderr(`Invalid Employee recipe: ${path}\n${formatRecipeIssues(result.issues)}\n`)
    return undefined
  }

  return result.value
}

async function validateRecipeFile(path: string, io: CliIO): Promise<boolean> {
  const recipe = await readRecipeFile(path, io)
  if (!recipe) return false

  io.stdout(
    `Valid Employee recipe: ${recipe.metadata.name} (${recipe.apiVersion})\n`,
  )
  return true
}

async function compileRecipeFile(
  path: string,
  outputDirectory: string,
  io: CliIO,
  dependencies: CliDependencies,
): Promise<boolean> {
  const recipe = await readRecipeFile(path, io)
  if (!recipe) return false

  try {
    const result = await dependencies.compileCapabilities({
      outputDirectory,
      recipe,
      recipePath: path,
    })
    io.stdout(
      `Compiled capabilities: ${recipe.metadata.name} -> ${result.outputDirectory} (${result.lock.skillRoot.digest})\n`,
    )
    return true
  } catch (error) {
    io.stderr(`Unable to compile recipe "${path}": ${errorMessage(error)}\n`)
    return false
  }
}

export async function runCli(
  argv: string[],
  io: CliIO = processIO,
  dependencies: CliDependencies = processDependencies,
): Promise<number> {
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

  recipe
    .command('compile')
    .description('Compile locked capability runtime inputs for an Employee recipe')
    .argument('<path>', 'path to the recipe')
    .requiredOption('-o, --output <path>', 'new output directory for compiled inputs')
    .action(async (path: string, options: { output: string }) => {
      if (
        !(await compileRecipeFile(
          resolve(path),
          resolve(options.output),
          io,
          dependencies,
        ))
      ) {
        exitCode = 1
      }
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
