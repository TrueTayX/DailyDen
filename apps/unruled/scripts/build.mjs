import { cp, mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const dist = resolve(root, 'dist')
const playtest = process.argv.includes('--playtest')
const analytics = process.argv.includes('--analytics')
if (playtest && analytics) throw new Error('Build the playtest and analytics-enabled releases separately')

const temporary = await mkdtemp(resolve(dirname(dist), '.rulebreaker-build-'))
try {
  await mkdir(temporary, { recursive: true })
  await cp(resolve(root, 'public'), temporary, { recursive: true })
  const index = resolve(temporary, 'index.html')
  let html = await readFile(index, 'utf8')
  if (playtest) {
    html = html.replace('<html lang="en">', '<html lang="en" data-playtest="true">')
      .replace('<title>', '<meta name="robots" content="noindex, nofollow">\n  <title>')
  }
  if (analytics) html = html.replace('<title>', '<meta name="rulebreaker-analytics" content="./api/events">\n  <title>')
  await writeFile(index, html)
  await rm(dist, { recursive: true, force: true })
  await rename(temporary, dist)
  console.log(`Built ${playtest ? 'the private playtest' : 'the daily game'} in dist/.`)
} finally {
  await rm(temporary, { recursive: true, force: true })
}
