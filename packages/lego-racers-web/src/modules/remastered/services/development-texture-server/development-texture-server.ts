import type { ServerResponse } from 'node:http'
import { createReadStream, existsSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import type { Plugin } from 'vite'
import { DEVELOPMENT_HIGH_DEFINITION_AUDIO_ROUTE } from '../high-definition-audio/high-definition-audio-route.ts'
import { DEVELOPMENT_HIGH_DEFINITION_ROUTE } from '../high-definition-texture/high-definition-route.ts'
import type { PackServer } from './development-texture-server.types.ts'

const getPackPaths = (directory: string, extension: string): readonly string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return getPackPaths(path, extension)
    return entry.name.toLowerCase().endsWith(extension) ? [path] : []
  })

// Serves a pack tree to the dev server only: `<root>/<variant>/<archive path>.<extension>`, looked up case-insensitively.
// `/` lists the variants and `/<variant>/` lists the files of one (lower case, with the extension).
const developmentPackPlugin = (root: string, server: PackServer): Plugin => ({
  name: server.name,
  apply: 'serve',
  configureServer: (viteServer) => {
    const variants = new Map<string, ReadonlyMap<string, string>>()
    const getVariant = (variant: string): ReadonlyMap<string, string> => {
      const known = variants.get(variant)
      if (known !== undefined) return known
      const directory = join(root, variant)
      const pathsByKey = new Map(
        (existsSync(directory) ? getPackPaths(directory, server.extension) : []).map((path) => [
          relative(directory, path).replaceAll('\\', '/').toLowerCase(),
          path,
        ])
      )
      variants.set(variant, pathsByKey)
      return pathsByKey
    }
    const sendJson = (response: ServerResponse, body: readonly string[]) => {
      response.setHeader('Content-Type', 'application/json')
      response.end(JSON.stringify(body))
    }
    viteServer.middlewares.use(server.route, (request, response) => {
      if ((request.url ?? '/') === '/') {
        const names = existsSync(root)
          ? readdirSync(root, { withFileTypes: true })
              .filter((entry) => entry.isDirectory())
              .map((entry) => entry.name)
              .sort()
          : []
        sendJson(response, names)
        return
      }
      const [variant = '', ...rest] = decodeURIComponent(
        (request.url ?? '').replace(/^\//, '').split('?')[0] ?? ''
      ).split('/')
      const isVariantValid = /^[\w.-]+$/.test(variant)
      if (isVariantValid && rest.join('/') === '') {
        sendJson(response, [...getVariant(variant).keys()])
        return
      }
      const path = isVariantValid
        ? getVariant(variant).get(rest.join('/').toLowerCase())
        : undefined
      if (path === undefined) {
        response.writeHead(404)
        response.end()
        return
      }
      response.setHeader('Content-Type', server.contentType)
      response.setHeader('Content-Length', String(statSync(path).size))
      createReadStream(path).pipe(response)
    })
  },
})

// The upscaled texture packs (`LEGO_HD_TEXTURES_ROOT`, by default `~/textures/lego-racers`).
export const developmentHighDefinitionPlugin = (root: string): Plugin =>
  developmentPackPlugin(root, {
    name: 'lego-racers-development-high-definition',
    route: DEVELOPMENT_HIGH_DEFINITION_ROUTE,
    extension: '.png',
    contentType: 'image/png',
  })

// The audio packs (`LEGO_HD_AUDIO_ROOT`, by default `~/audio/lego-racers`).
export const developmentHighDefinitionAudioPlugin = (root: string): Plugin =>
  developmentPackPlugin(root, {
    name: 'lego-racers-development-high-definition-audio',
    route: DEVELOPMENT_HIGH_DEFINITION_AUDIO_ROUTE,
    extension: '.wav',
    contentType: 'audio/wav',
  })
