import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServer } from 'vite'
import { developmentReplayInboxPlugin } from './replay-inbox-server.ts'

const RECORDING = `${JSON.stringify({ raceFolder: 'RACEC0R0' })}\n[33,[],null,null,null]\n`

const postRecording = async (directory: string, name: string, body: string) => {
  const server = await createServer({
    configFile: false,
    logLevel: 'silent',
    plugins: [developmentReplayInboxPlugin(directory)],
    server: { port: 0, host: '127.0.0.1' },
  })
  await server.listen()
  try {
    const address = server.httpServer?.address()
    const port = typeof address === 'object' && address !== null ? address.port : 0
    const response = await fetch(
      `http://127.0.0.1:${String(port)}/__development/replay-inbox?name=${name}`,
      { method: 'POST', body }
    )
    return response.status
  } finally {
    await server.close()
  }
}

describe('the replay inbox route', () => {
  it('writes a posted recording into the inbox folder', async () => {
    // Arrange
    const directory = join(mkdtempSync(join(tmpdir(), 'inbox-')), 'inbox')

    // Act
    const status = await postRecording(directory, 'RACEC0R0-1.replay.jsonl', RECORDING)

    // Assert
    expect(status).toBe(204)
    expect(readFileSync(join(directory, 'RACEC0R0-1.replay.jsonl'), 'utf8')).toBe(RECORDING)
    rmSync(directory, { recursive: true })
  })

  it('refuses a path, a wrong extension and a body that is not a recording', async () => {
    // Arrange
    const directory = join(mkdtempSync(join(tmpdir(), 'inbox-')), 'inbox')

    // Act
    const statuses = [
      await postRecording(directory, '..%2Fescape.replay.jsonl', RECORDING),
      await postRecording(directory, 'file.txt', RECORDING),
      await postRecording(directory, 'file.replay.jsonl', 'not json'),
    ]

    // Assert
    expect(statuses).toEqual([400, 400, 400])
    expect(existsSync(directory)).toBe(false)
  })
})
