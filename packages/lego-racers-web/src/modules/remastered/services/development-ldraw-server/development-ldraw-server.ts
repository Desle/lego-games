import { createReadStream, existsSync, statSync } from 'node:fs'
import { join, normalize, sep } from 'node:path'
import type { ServerResponse } from 'node:http'
import type { Plugin } from 'vite'
import { DEVELOPMENT_LDRAW_ROUTE } from '../ldraw-library/ldraw-library-route.ts'

const getFilePath = (root: string, relativePath: string): string | null => {
  const path = normalize(join(root, relativePath))
  return path.startsWith(root + sep) && existsSync(path) && statSync(path).isFile() ? path : null
}

// Answers with the file as plain text, or with a 404 when there is none.
export const serveTextFile = (response: ServerResponse, path: string | null) => {
  if (path === null) {
    response.writeHead(404)
    response.end()
    return
  }
  response.setHeader('Content-Type', 'text/plain; charset=utf-8')
  response.setHeader('Content-Length', String(statSync(path).size))
  createReadStream(path).pipe(response)
}

// Serves the LDraw parts library to the dev server only: `<root>/parts/3001.dat`, `<root>/p/stud.dat`, `<root>/LDConfig.ldr`.
// The library's files are lower case but a model may name them in any case, so the lower-case name is tried second.
export const developmentLDrawPlugin = (root: string): Plugin => ({
  name: 'lego-racers-development-ldraw',
  apply: 'serve',
  configureServer: (server) =>
    void server.middlewares.use(DEVELOPMENT_LDRAW_ROUTE, (request, response) => {
      const requested = decodeURIComponent(
        (request.url ?? '').replace(/^\//, '').split('?')[0] ?? ''
      )
      const path = getFilePath(root, requested) ?? getFilePath(root, requested.toLowerCase())
      serveTextFile(response, path)
    }),
})
