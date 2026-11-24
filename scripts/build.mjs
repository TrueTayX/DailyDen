import { execFileSync } from 'node:child_process'
import { cp, mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const build = ['--prefix', 'apps/unruled', 'run', 'build']
if (process.argv.includes('--analytics')) build.push('--', '--analytics')
execFileSync('npm', build, { cwd: root, stdio: 'inherit' })

const output = join(root, 'dist')
const staging = await mkdtemp(join(root, '.daily-den-build-'))
try {
  await cp(join(root, 'apps/home'), staging, { recursive: true })
  await cp(join(root, 'apps/unruled/dist'), join(staging, 'unruled'), { recursive: true })
  const shell = join(root, 'packages/shell')
  const footer = (await readFile(join(shell, 'footer.html'), 'utf8')).trimEnd().replace(/^/gm, '  ')
  const assets = join(staging, 'assets')
  await mkdir(assets, { recursive: true })
  await cp(join(shell, 'footer.css'), join(assets, 'daily-den-footer.css'))
  const footerPages = {
    'index.html': 'Daily Den feedback',
    'privacy.html': 'Daily Den privacy question',
    'unruled/index.html': 'Unruled feedback',
    'unruled/privacy.html': 'Unruled feedback',
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
  await writeFile(join(staging, '_headers'), headers.replace(/^\//gm, '/unruled/'))
  await rm(gameHeaders)
  await rm(output, { recursive: true, force: true })
  await rename(staging, output)
  console.log('Built Daily Den and /unruled/ in dist/.')
} finally {
  await rm(staging, { recursive: true, force: true })
}
