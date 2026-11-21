import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { resolve, sep, extname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../public/', import.meta.url))
const port = Number(process.env.PORT || 4173)
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
}
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname)
    const path = resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname))
    const type = mime[extname(path)]
    if (!path.startsWith(root.endsWith(sep) ? root : root + sep) || !type) throw new Error('Unknown path')
    const data = await readFile(path)
    response.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' })
    response.end(request.method === 'HEAD' ? undefined : data)
  } catch {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
    response.end('Not found')
  }
})

server.listen(port, '0.0.0.0', () => console.log(`Rulebreaker is serving on port ${server.address().port}`))
