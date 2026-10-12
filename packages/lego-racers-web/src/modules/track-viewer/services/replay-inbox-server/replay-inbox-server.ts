import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Plugin } from 'vite'
import { DEVELOPMENT_REPLAY_INBOX_ROUTE } from '../../../../shared/development-jam/development-replay-inbox-route.ts'

const RECORDING_FILE_NAME = /^[\w-]+\.replay\.jsonl$/
const MAXIMUM_BODY_BYTES = 64 * 1024 * 1024

const getIsRecordingText = (text: string): boolean => {
  const [headerLine = ''] = text.split('\n', 1)
  try {
    const header: unknown = JSON.parse(headerLine)
    return typeof header === 'object' && header !== null && 'raceFolder' in header
  } catch {
    return false
  }
}

// Receives finished recordings on the dev server only (`apply: 'serve'`) and writes `<directory>/<name>.replay.jsonl`.
export const developmentReplayInboxPlugin = (directory: string): Plugin => ({
  name: 'lego-racers-development-replay-inbox',
  apply: 'serve',
  configureServer: (server) => {
    const { middlewares } = server
    middlewares.use(DEVELOPMENT_REPLAY_INBOX_ROUTE, (request, response) => {
      const name = new URL(request.url ?? '/', 'http://localhost').searchParams.get('name') ?? ''
      if (request.method !== 'POST' || !RECORDING_FILE_NAME.test(name)) {
        response.writeHead(400)
        response.end('POST a *.replay.jsonl body with ?name=<file name>')
        return
      }
      const chunks: Buffer[] = []
      let byteCount = 0
      request.on('data', (chunk: Buffer) => {
        byteCount += chunk.length
        if (byteCount <= MAXIMUM_BODY_BYTES) chunks.push(chunk)
      })
      request.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8')
        if (byteCount > MAXIMUM_BODY_BYTES || !getIsRecordingText(text)) {
          response.writeHead(400)
          response.end('Not a recording')
          return
        }
        mkdirSync(directory, { recursive: true })
        writeFileSync(join(directory, name), text)
        response.writeHead(204)
        response.end()
      })
    })
  },
})
