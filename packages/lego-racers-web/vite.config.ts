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

// Serves an upscaled texture pack to the dev server only, looked up case-insensitively by archive path.
const developmentHighDefinitionPlugin = (): Plugin => ({
  name: 'lego-racers-development-high-definition',
  apply: 'serve',
  configureServer: (server) => {
    const directory =
      process.env['LEGO_HD_TEXTURES_PATH'] ?? join(homedir(), 'lego-racers-textures-hd')
    const pathsByKey = new Map(
      (existsSync(directory) ? getPngPaths(directory) : []).map((path) => [
        relative(directory, path).replaceAll('\\', '/').toLowerCase(),
        path,
      ])
    )
    server.middlewares.use(DEVELOPMENT_HIGH_DEFINITION_ROUTE, (request, response) => {
      const key = decodeURIComponent(
        (request.url ?? '').replace(/^\//, '').split('?')[0] ?? ''
      ).toLowerCase()
      const path = pathsByKey.get(key)
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
