import { createReadStream, existsSync, readdirSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, relative, resolve } from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import type { Plugin } from 'vite'
import {
  DEVELOPMENT_GAME_FILE_ROUTE,
  DEVELOPMENT_HIGH_DEFINITION_ROUTE,
  DEVELOPMENT_JAM_ROUTE,
} from './src/shared/development-jam/development-jam-route.ts'

const DEFAULT_JAM_PATH = resolve(
  import.meta.dirname,
  '../../original-files/Lego_Racers_Win_Files_EN/Game Files/LEGO.JAM'
)

// Serves the local LEGO.JAM to the dev server only (`apply: 'serve'`): nothing of it reaches a build.
const developmentJamPlugin = (): Plugin => ({
  name: 'lego-racers-development-jam',
  apply: 'serve',
  configureServer: (server) => {
    const jamPath = process.env['LEGO_JAM_PATH'] ?? DEFAULT_JAM_PATH
    server.middlewares.use(DEVELOPMENT_JAM_ROUTE, (_request, response) => {
      if (!existsSync(jamPath)) {
        response.writeHead(404)
        response.end(`No LEGO.JAM at ${jamPath}`)
        return
      }
      response.setHeader('Content-Type', 'application/octet-stream')
      response.setHeader('Content-Length', String(statSync(jamPath).size))
      createReadStream(jamPath).pipe(response)
    })
  },
})

// Only the executable and the music are served, by plain file name.
const GAME_FILE_NAME = /^(LEGORacers\.exe|[A-Za-z0-9_-]+\.tun)$/

// Serves `LEGORacers.exe` and the `.tun` files next to the local LEGO.JAM to the dev server only.
const developmentGameFilesPlugin = (): Plugin => ({
  name: 'lego-racers-development-game-files',
  apply: 'serve',
  configureServer: (server) => {
    const directory = dirname(process.env['LEGO_JAM_PATH'] ?? DEFAULT_JAM_PATH)
    server.middlewares.use(DEVELOPMENT_GAME_FILE_ROUTE, (request, response) => {
      const name = decodeURIComponent((request.url ?? '').replace(/^\//, '').split('?')[0] ?? '')
      const path = resolve(directory, name)
      if (!GAME_FILE_NAME.test(name) || !existsSync(path)) {
        response.writeHead(404)
        response.end(`No game file ${name}`)
        return
      }
      response.setHeader('Content-Type', 'application/octet-stream')
      response.setHeader('Content-Length', String(statSync(path).size))
      createReadStream(path).pipe(response)
    })
  },
})

const getPngPaths = (directory: string): readonly string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return getPngPaths(path)
    return /\.png$/i.test(entry.name) ? [path] : []
  })

// Serves upscaled texture packs to the dev server only: `<root>/<variant>/<archive path>.png`, looked up
// case-insensitively. The root is `LEGO_HD_TEXTURES_ROOT`, by default `~/textures/lego-racers`.
const developmentHighDefinitionPlugin = (): Plugin => ({
  name: 'lego-racers-development-high-definition',
  apply: 'serve',
  configureServer: (server) => {
    const root = process.env['LEGO_HD_TEXTURES_ROOT'] ?? join(homedir(), 'textures', 'lego-racers')
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

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    developmentJamPlugin(),
    developmentGameFilesPlugin(),
    developmentHighDefinitionPlugin(),
  ],
})
