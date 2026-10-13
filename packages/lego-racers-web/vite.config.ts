import { createReadStream, existsSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import type { Plugin } from 'vite'
import { developmentLDrawModelsPlugin } from './src/modules/remastered/services/development-ldraw-models-server/development-ldraw-models-server.ts'
import { developmentLDrawPlugin } from './src/modules/remastered/services/development-ldraw-server/development-ldraw-server.ts'
import {
  developmentHighDefinitionAudioPlugin,
  developmentHighDefinitionPlugin,
} from './src/modules/remastered/services/development-texture-server/development-texture-server.ts'
import { developmentReplayInboxPlugin } from './src/modules/track-viewer/services/replay-inbox-server/replay-inbox-server.ts'
import {
  DEVELOPMENT_GAME_FILE_ROUTE,
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

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    developmentJamPlugin(),
    developmentGameFilesPlugin(),
    developmentReplayInboxPlugin(
      process.env['LEGO_REPLAY_INBOX'] ??
        resolve(import.meta.dirname, '../../reverse-engineering/replays/inbox')
    ),
    developmentHighDefinitionPlugin(
      process.env['LEGO_HD_TEXTURES_ROOT'] ?? join(homedir(), 'textures', 'lego-racers')
    ),
    developmentHighDefinitionAudioPlugin(
      process.env['LEGO_HD_AUDIO_ROOT'] ?? join(homedir(), 'audio', 'lego-racers')
    ),
    developmentLDrawPlugin(process.env['LEGO_LDRAW_ROOT'] ?? join(homedir(), 'ldraw')),
    developmentLDrawModelsPlugin(
      process.env['LEGO_LDRAW_MODELS_ROOT'] ?? join(homedir(), 'ldraw-models')
    ),
  ],
})
