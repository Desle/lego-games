import { createReadStream, existsSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import type { Plugin } from 'vite'
import { DEVELOPMENT_JAM_ROUTE } from './src/shared/development-jam/development-jam-route.ts'

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

export default defineConfig({
  plugins: [react(), tailwindcss(), developmentJamPlugin()],
})
