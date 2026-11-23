import { execFileSync } from 'node:child_process'
import { cp, mkdtemp, rename, rm } from 'node:fs/promises'
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
  await rm(output, { recursive: true, force: true })
  await rename(staging, output)
  console.log('Built Daily Den and /unruled/ in dist/.')
} finally {
  await rm(staging, { recursive: true, force: true })
}
