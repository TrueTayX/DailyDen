import { execFileSync } from 'node:child_process'
import { cp, mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { GAME_ID as CROSSWIRED } from '../apps/crosswired/public/config.mjs'
import { publicCalendar } from '../apps/crosswired/scripts/publication.mjs'

const root = fileURLToPath(new URL('../', import.meta.url))
const build = ['--prefix', 'apps/unruled', 'run', 'build']
if (process.argv.includes('--analytics')) build.push('--', '--analytics')
execFileSync('npm', build, { cwd: root, stdio: 'inherit' })

const output = join(root, 'dist')
const staging = await mkdtemp(join(root, '.daily-den-build-'))
try {
  await cp(join(root, 'apps/home'), staging, { recursive: true })
  await cp(join(root, 'apps/unruled/dist'), join(staging, 'unruled'), { recursive: true })
  const crosswired = join(root, 'apps', CROSSWIRED)
  const archive = JSON.parse(await readFile(join(crosswired, 'content/calendar.json'), 'utf8'))
  const through = (await readFile(join(crosswired, 'content/published-through.txt'), 'utf8')).trim()
  if (!archive.calendar.some(day => day.date === through)) throw new Error('Invalid Crosswired release date')
  await cp(join(crosswired, 'public'), join(staging, CROSSWIRED), { recursive: true })
  await writeFile(join(staging, CROSSWIRED, 'calendar.json'), JSON.stringify(publicCalendar(archive, through)) + '\n')
  const shell = join(root, 'packages/shell')
  const footer = (await readFile(join(shell, 'footer.html'), 'utf8')).trimEnd().replace(/^/gm, '  ')
  const assets = join(staging, 'assets')
  await mkdir(assets, { recursive: true })
  await cp(join(shell, 'footer.css'), join(assets, 'daily-den-footer.css'))
  await cp(join(root, 'packages/game/daily.mjs'), join(assets, 'game-daily.mjs'))
  const footerPages = {
    'index.html': 'Daily Den feedback',
    'privacy.html': 'Daily Den privacy question',
    'unruled/index.html': 'Unruled feedback',
    'unruled/privacy.html': 'Unruled feedback',
    [`${CROSSWIRED}/index.html`]: 'Crosswired feedback',
  }
  const slot = /^  <!-- site-footer:start -->[\s\S]*?<!-- site-footer:end -->/m
  for (const [page, subject] of Object.entries(footerPages)) {
    const path = join(staging, page)
    const html = await readFile(path, 'utf8')
    if (!slot.test(html)) throw new Error(`Missing site footer slot in ${page}`)
    const footerHtml = footer.replace('__FEEDBACK_SUBJECT__', encodeURIComponent(subject))
    await writeFile(path, html
      .replace('</head>', '  <link rel="stylesheet" href="/assets/daily-den-footer.css">\n</head>')
      .replace(slot, footerHtml))
  }

  // Cloudflare Pages reads _headers only at the upload root.
  const gameHeaders = join(staging, 'unruled', '_headers')
  const headers = await readFile(gameHeaders, 'utf8')
  await writeFile(join(staging, '_headers'), headers.replace(/^\//gm, '/unruled/')
    + `/${CROSSWIRED}/calendar.json\n  Cache-Control: no-cache\n`)
  await rm(gameHeaders)
  await rm(output, { recursive: true, force: true })
  await rename(staging, output)
  console.log('Built Daily Den, Unruled, and Crosswired in dist/.')
} finally {
  await rm(staging, { recursive: true, force: true })
}
