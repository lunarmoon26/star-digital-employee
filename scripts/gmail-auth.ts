/**
 * One-time OAuth consent flow for the Gmail connector. Obtains a refresh token
 * from an OAuth 2.0 client (Desktop app) and writes GMAIL_CLIENT_ID,
 * GMAIL_CLIENT_SECRET, and GMAIL_REFRESH_TOKEN to `.env`.
 *
 * Setup (Google Cloud Console, project cyberhud-504302):
 *   1. APIs & Services → OAuth consent screen → User type: Internal → add the
 *      Gmail scopes below.
 *   2. Credentials → Create credentials → OAuth client ID → Application type:
 *      Desktop app.
 *   3. Copy GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET into `.env`.
 *
 * Then run:
 *   pnpm gmail:auth
 */

try {
  process.loadEnvFile()
} catch {
  // No .env file — fall back to already-exported environment variables.
}

import { readFile, writeFile } from 'node:fs/promises'
import { obtainGmailRefreshToken } from '@star/employee-connector'

const clientId = process.env.GMAIL_CLIENT_ID
const clientSecret = process.env.GMAIL_CLIENT_SECRET
if (!clientId || !clientSecret) {
  throw new Error('set GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET in .env first')
}

const refreshToken = await obtainGmailRefreshToken({
  clientId,
  clientSecret,
  onAuthorizationUrl: (url) => {
    process.stdout.write(`Open this URL in your browser and authorize:\n\n${url}\n\nWaiting for the redirect…\n`)
  },
})

await upsertEnv({
  GMAIL_CLIENT_ID: clientId,
  GMAIL_CLIENT_SECRET: clientSecret,
  GMAIL_REFRESH_TOKEN: refreshToken,
})
process.stdout.write('Wrote GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, and GMAIL_REFRESH_TOKEN to .env\n')

async function upsertEnv(entries: Record<string, string>): Promise<void> {
  const path = '.env'
  let source = ''
  try {
    source = await readFile(path, 'utf8')
  } catch {
    // No .env yet.
  }
  const keys = new Set(Object.keys(entries))
  const kept = source.split('\n').filter((line) => {
    const match = /^([A-Za-z_][A-Za-z0-9_]*)=/.exec(line)
    return !(match !== null && keys.has(match[1]!))
  })
  for (const [key, value] of Object.entries(entries)) kept.push(`${key}=${value}`)
  await writeFile(path, `${kept.filter((line) => line !== '').join('\n')}\n`, 'utf8')
}
