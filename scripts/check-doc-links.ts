import { access, readdir, readFile } from 'node:fs/promises'
import { dirname, extname, resolve } from 'node:path'

const rootFiles = ['README.md', 'CONTRIBUTING.md', 'CHANGELOG.md']
const documentationDirectories = ['docs', 'schemas']
const markdownLink = /\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g

async function markdownFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true })
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const path = resolve(directory, entry.name)
      if (entry.isDirectory()) return markdownFiles(path)
      return extname(entry.name) === '.md' ? [path] : []
    }),
  )
  return nested.flat()
}

function localTarget(rawTarget: string): string | undefined {
  if (rawTarget.startsWith('#')) return undefined
  if (/^[a-z][a-z0-9+.-]*:/i.test(rawTarget)) return undefined
  return decodeURIComponent(rawTarget.split('#', 1)[0] ?? '')
}

const files = [
  ...rootFiles.map((path) => resolve(path)),
  ...(await Promise.all(documentationDirectories.map(markdownFiles))).flat(),
]
const failures: string[] = []

for (const file of files) {
  const source = await readFile(file, 'utf8')
  for (const match of source.matchAll(markdownLink)) {
    const target = localTarget(match[1] ?? '')
    if (!target) continue
    const path = resolve(dirname(file), target)
    try {
      await access(path)
    } catch {
      failures.push(`${file}: missing local link target ${target}`)
    }
  }
}

if (failures.length > 0) {
  process.stderr.write(`${failures.join('\n')}\n`)
  process.exitCode = 1
} else {
  process.stdout.write(`Checked local links in ${files.length} documentation files.\n`)
}
