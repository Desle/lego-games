import { createReadStream, existsSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import type { Plugin } from 'vite'
import { DEVELOPMENT_HIGH_DEFINITION_ROUTE } from '../high-definition-texture/high-definition-route.ts'

const getPngPaths = (directory: string): readonly string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return getPngPaths(path)
    return /\.png$/i.test(entry.name) ? [path] : []
  })

// Serves upscaled texture packs to the dev server only: `<root>/<variant>/<archive path>.png`, looked up
// case-insensitively. The root comes from the Vite config (`LEGO_HD_TEXTURES_ROOT`, by default `~/textures/lego-racers`).
export const developmentHighDefinitionPlugin = (root: string): Plugin => ({
  name: 'lego-racers-development-high-definition',
  apply: 'serve',
  configureServer: (server) => {
    const variants = new Map<string, ReadonlyMap<string, string>>()
    const getVariant = (variant: string): ReadonlyMap<string, string> => {
      const known = variants.get(variant)
      if (known !== undefined) return known
      const directory = join(root, variant)
      const pathsByKey = new Map(
        (existsSync(directory) ? getPngPaths(directory) : []).map((path) => [
          relative(directory, path).replaceAll('\\', '/').toLowerCase(),
          path,
        ])
      )
      variants.set(variant, pathsByKey)
      return pathsByKey
    }
    server.middlewares.use(DEVELOPMENT_HIGH_DEFINITION_ROUTE, (request, response) => {
      if ((request.url ?? '/') === '/') {
        const names = existsSync(root)
          ? readdirSync(root, { withFileTypes: true })
              .filter((entry) => entry.isDirectory())
              .map((entry) => entry.name)
              .sort()
          : []
        response.setHeader('Content-Type', 'application/json')
        response.end(JSON.stringify(names))
        return
      }
      const [variant = '', ...rest] = decodeURIComponent(
        (request.url ?? '').replace(/^\//, '').split('?')[0] ?? ''
      ).split('/')
      const path = /^[\w.-]+$/.test(variant)
        ? getVariant(variant).get(rest.join('/').toLowerCase())
        : undefined
      if (path === undefined) {
        response.writeHead(404)
        response.end()
        return
      }
      response.setHeader('Content-Type', 'image/png')
      response.setHeader('Content-Length', String(statSync(path).size))
      createReadStream(path).pipe(response)
    })
  },
})
