import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { getLDrawFileRoutePaths } from '@lego-games/ldraw-studio/files'
import { DEVELOPMENT_LDRAW_BUILDER_ROUTE } from '../ldraw-builder/ldraw-builder-route.ts'
import { DEVELOPMENT_LDRAW_ROUTE } from '../ldraw-library/ldraw-library-route.ts'
import { DEVELOPMENT_LDRAW_MODELS_ROUTE } from '../ldraw-models/ldraw-models-route.ts'
import {
  DEVELOPMENT_ROUTE_PREFIX,
  createRacersLDrawFileRoutes,
} from './development-ldraw-files-plugin.ts'

const MODEL_TEXT = '0 new\n1 4 0 -24 0 1 0 0 0 1 0 0 0 1 3001.dat\n'

describe('createRacersLDrawFileRoutes', () => {
  it('serves on the routes the pages fetch', () => {
    // Arrange
    const pageRoutes = {
      LIBRARY: DEVELOPMENT_LDRAW_ROUTE,
      MODELS: DEVELOPMENT_LDRAW_MODELS_ROUTE,
      BUILDER: DEVELOPMENT_LDRAW_BUILDER_ROUTE,
    }

    // Act
    const servedRoutes = getLDrawFileRoutePaths(DEVELOPMENT_ROUTE_PREFIX)

    // Assert
    expect(servedRoutes).toEqual(pageRoutes)
  })

  it('saves a builder item to its file after a backup, marks it done and answers the progress', async () => {
    // Arrange
    const root = mkdtempSync(join(tmpdir(), 'ldraw-builder-'))
    mkdirSync(join(root, 'chassis'))
    writeFileSync(join(root, 'chassis', 'RRchas0.ldr'), '0 old\n')
    const routes = createRacersLDrawFileRoutes(join(root, 'library'), root)
    const server = createServer((request, response) => routes(request, response, () => undefined))
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    const { port } = server.address() as AddressInfo

    // Act
    const response = await fetch(
      `http://127.0.0.1:${String(port)}${DEVELOPMENT_LDRAW_BUILDER_ROUTE}/save`,
      { method: 'POST', body: JSON.stringify({ itemId: 'chassis/rrchas0', text: MODEL_TEXT }) }
    ).finally(() => server.close())

    // Assert
    expect(await response.json()).toEqual({
      path: 'chassis/RRchas0.ldr',
      backupPath: expect.stringMatching(/^drafts\/backups\/RRchas0-.+\.ldr$/) as unknown,
      progress: { done: ['chassis/rrchas0'] },
    })
    expect(readFileSync(join(root, 'chassis', 'RRchas0.ldr'), 'utf8')).toBe(MODEL_TEXT)
    expect(readdirSync(join(root, 'drafts', 'backups'))).toHaveLength(1)
  })

  it('removes a builder item by moving its file into the backups, unmarks it and answers the progress', async () => {
    // Arrange
    const root = mkdtempSync(join(tmpdir(), 'ldraw-builder-'))
    mkdirSync(join(root, 'powerups'))
    writeFileSync(join(root, 'powerups', 'BARREL.ldr'), MODEL_TEXT)
    writeFileSync(
      join(root, 'builder-progress.json'),
      JSON.stringify({ done: ['powerups/BARREL', 'RRCM'] })
    )
    const routes = createRacersLDrawFileRoutes(join(root, 'library'), root)
    const server = createServer((request, response) => routes(request, response, () => undefined))
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    const { port } = server.address() as AddressInfo

    // Act
    const response = await fetch(
      `http://127.0.0.1:${String(port)}${DEVELOPMENT_LDRAW_BUILDER_ROUTE}/remove`,
      { method: 'POST', body: JSON.stringify({ itemId: 'powerups/BARREL' }) }
    ).finally(() => server.close())

    // Assert
    const answer = (await response.json()) as { readonly backupPath: string }
    expect(answer).toEqual({
      path: 'powerups/BARREL.ldr',
      backupPath: expect.stringMatching(/^drafts\/backups\/BARREL-.+\.ldr$/) as unknown,
      progress: { done: ['RRCM'] },
    })
    expect(existsSync(join(root, 'powerups', 'BARREL.ldr'))).toBe(false)
    expect(readFileSync(join(root, answer.backupPath), 'utf8')).toBe(MODEL_TEXT)
  })
})
