import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createLDrawFileRoutes } from './ldraw-file-routes.ts'
import type { LDrawFileRoutesOptions } from './ldraw-file-routes.types.ts'

const PREFIX = '/__files'
const MODEL_TEXT = '0 model\n1 4 0 0 0 1 0 0 0 1 0 0 0 1 3001.dat\n'

const createFolders = () => {
  const parent = mkdtempSync(join(tmpdir(), 'ldraw-file-routes-'))
  const libraryRoot = join(parent, 'library')
  const modelsRoot = join(parent, 'models')
  mkdirSync(join(libraryRoot, 'parts'), { recursive: true })
  mkdirSync(join(modelsRoot, 'boats'), { recursive: true })
  writeFileSync(join(libraryRoot, 'parts', '3001.dat'), '0 Brick  2 x  4\n')
  writeFileSync(join(modelsRoot, 'Ferry.ldr'), '0 ferry\n')
  writeFileSync(join(modelsRoot, 'boats', 'tug.mpd'), '0 tug\n')
  writeFileSync(join(modelsRoot, 'notes.txt'), 'not a model')
  writeFileSync(join(parent, 'secret.ldr'), '0 secret\n')
  return { parent, libraryRoot, modelsRoot }
}

type Options = Omit<LDrawFileRoutesOptions, 'routePrefix'>

// Serves the routes on a free local port for one request and answers with its status and body.
const fetchFrom = async (options: Options, path: string, request?: RequestInit) => {
  const routes = createLDrawFileRoutes({ ...options, routePrefix: PREFIX })
  const server = createServer((request, response) =>
    routes(request, response, () => {
      response.writeHead(418)
      response.end('next')
    })
  )
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address() as AddressInfo
  try {
    const response = await fetch(`http://127.0.0.1:${String(port)}${path}`, request)
    return { status: response.status, body: await response.text() }
  } finally {
    server.close()
  }
}

const postSave = (options: Options, body: unknown) =>
  fetchFrom(options, `${PREFIX}/ldraw-builder/save`, {
    method: 'POST',
    body: JSON.stringify(body),
  })

const postRemove = (options: Options, body: unknown) =>
  fetchFrom(options, `${PREFIX}/ldraw-builder/remove`, {
    method: 'POST',
    body: JSON.stringify(body),
  })

describe('createLDrawFileRoutes', () => {
  it('serves a library part by any case and refuses paths out of the library', async () => {
    // Arrange
    const folders = createFolders()

    // Act
    const part = await fetchFrom(folders, `${PREFIX}/ldraw/parts/3001.DAT`)
    const escape = await fetchFrom(folders, `${PREFIX}/ldraw/..%2Fsecret.ldr`)

    // Assert
    expect(part).toEqual({ status: 200, body: '0 Brick  2 x  4\n' })
    expect(escape.status).toBe(404)
  })

  it('lists the models folder by folder and as files, and serves model files only', async () => {
    // Arrange
    const folders = createFolders()

    // Act
    const index = await fetchFrom(folders, `${PREFIX}/ldraw-models/index.json`)
    const files = await fetchFrom(folders, `${PREFIX}/ldraw-models/files.json`)
    const model = await fetchFrom(folders, `${PREFIX}/ldraw-models/boats/tug.mpd?reload=1`)
    const notModel = await fetchFrom(folders, `${PREFIX}/ldraw-models/notes.txt`)
    const escape = await fetchFrom(folders, `${PREFIX}/ldraw-models/..%2Fsecret.ldr`)

    // Assert
    expect(JSON.parse(index.body)).toEqual({ '': ['Ferry.ldr'], boats: ['tug.mpd'] })
    expect(
      (JSON.parse(files.body) as readonly { readonly path: string }[]).map((file) => file.path)
    ).toEqual(['boats/tug.mpd', 'Ferry.ldr'])
    expect(model).toEqual({ status: 200, body: '0 tug\n' })
    expect(notModel.status).toBe(404)
    expect(escape.status).toBe(404)
  })

  it('answers the index in the shape the app asks for', async () => {
    // Arrange
    const folders = createFolders()
    const options = { ...folders, getModelIndex: () => ({ shape: 'app' }) }

    // Act
    const index = await fetchFrom(options, `${PREFIX}/ldraw-models/index.json`)

    // Assert
    expect(JSON.parse(index.body)).toEqual({ shape: 'app' })
  })

  it('lists the parts of the library and the json files the app adds', async () => {
    // Arrange
    const folders = createFolders()
    const options = { ...folders, builderJsonFiles: { 'extra.json': () => ({ isExtra: true }) } }

    // Act
    const parts = await fetchFrom(options, `${PREFIX}/ldraw-builder/parts.json`)
    const extra = await fetchFrom(options, `${PREFIX}/ldraw-builder/extra.json`)
    const unknown = await fetchFrom(options, `${PREFIX}/ldraw-builder/other.json`)

    // Assert
    expect(JSON.parse(parts.body)).toEqual([{ name: '3001.dat', description: 'Brick  2 x  4' }])
    expect(JSON.parse(extra.body)).toEqual({ isExtra: true })
    expect(unknown.status).toBe(404)
  })

  it('saves a model to its path with a backup of the file it replaces', async () => {
    // Arrange
    const folders = createFolders()

    // Act
    const saved = await postSave(folders, { path: 'Ferry.ldr', text: MODEL_TEXT })

    // Assert
    const answer = JSON.parse(saved.body) as { readonly backupPath: string }
    expect(answer).toEqual({
      path: 'Ferry.ldr',
      backupPath: expect.stringMatching(/^drafts\/backups\/Ferry-.+\.ldr$/) as unknown,
    })
    expect(readFileSync(join(folders.modelsRoot, 'Ferry.ldr'), 'utf8')).toBe(MODEL_TEXT)
    expect(readFileSync(join(folders.modelsRoot, answer.backupPath), 'utf8')).toBe('0 ferry\n')
  })

  it('saves where the app says and adds what the app answers', async () => {
    // Arrange
    const folders = createFolders()
    const options = {
      ...folders,
      backupFolder: 'old',
      getSavePath: (request: { readonly [key: string]: unknown }, existing: readonly string[]) =>
        existing.find((file) => file.toLowerCase() === `${String(request['name'])}.ldr`) ?? null,
      onModelSaved: () => ({ isMarked: true }),
    }

    // Act
    const saved = await postSave(options, { name: 'ferry', text: MODEL_TEXT })
    const refused = await postSave(options, { name: 'unknown', text: MODEL_TEXT })

    // Assert
    expect(JSON.parse(saved.body)).toEqual({
      path: 'Ferry.ldr',
      backupPath: expect.stringMatching(/^old\/Ferry-/) as unknown,
      isMarked: true,
    })
    expect(refused.status).toBe(400)
  })

  it('refuses saves out of the folder, of no model text, and of no JSON', async () => {
    // Arrange
    const folders = createFolders()

    // Act
    const statuses = await Promise.all([
      postSave(folders, { path: '../secret.ldr', text: MODEL_TEXT }),
      postSave(folders, { path: join(folders.parent, 'secret.ldr'), text: MODEL_TEXT }),
      postSave(folders, { path: 'Ferry.ldr', text: '<html>' }),
      postSave(folders, 'not an object'),
    ])

    // Assert
    expect(statuses.map((answer) => answer.status)).toEqual([400, 400, 400, 400])
    expect(readFileSync(join(folders.parent, 'secret.ldr'), 'utf8')).toBe('0 secret\n')
    expect(readFileSync(join(folders.modelsRoot, 'Ferry.ldr'), 'utf8')).toBe('0 ferry\n')
  })

  it('removes a model by moving it into the backup folder and adds what the app answers', async () => {
    // Arrange
    const folders = createFolders()
    const options = { ...folders, onModelRemoved: () => ({ isUnmarked: true }) }

    // Act
    const removed = await postRemove(options, { path: 'Ferry.ldr' })
    const index = await fetchFrom(options, `${PREFIX}/ldraw-models/index.json`)

    // Assert
    const answer = JSON.parse(removed.body) as { readonly backupPath: string }
    expect(answer).toEqual({
      path: 'Ferry.ldr',
      backupPath: expect.stringMatching(/^drafts\/backups\/Ferry-.+\.ldr$/) as unknown,
      isUnmarked: true,
    })
    expect(existsSync(join(folders.modelsRoot, 'Ferry.ldr'))).toBe(false)
    expect(readFileSync(join(folders.modelsRoot, answer.backupPath), 'utf8')).toBe('0 ferry\n')
    expect(JSON.parse(index.body)).toEqual({
      boats: ['tug.mpd'],
      'drafts/backups': [answer.backupPath.split('/').pop()],
    })
  })

  it('removes the file the app names, and refuses unsafe, missing and non-ldr files', async () => {
    // Arrange
    const folders = createFolders()
    const options = {
      ...folders,
      getRemovePath: (request: { readonly [key: string]: unknown }) =>
        request['name'] === 'ferry' ? 'Ferry.ldr' : null,
    }

    // Act
    const statuses = await Promise.all([
      postRemove(folders, { path: '../secret.ldr' }),
      postRemove(folders, { path: join(folders.parent, 'secret.ldr') }),
      postRemove(folders, { path: 'boats/tug.mpd' }),
      postRemove(folders, { path: 'notes.txt' }),
      postRemove(folders, { path: 'missing.ldr' }),
      postRemove(folders, 'not an object'),
      postRemove(options, { name: 'unknown' }),
    ])
    const named = await postRemove(options, { name: 'ferry' })

    // Assert
    expect(statuses.map((answer) => answer.status)).toEqual([400, 400, 400, 400, 400, 400, 400])
    expect(readFileSync(join(folders.parent, 'secret.ldr'), 'utf8')).toBe('0 secret\n')
    expect(readFileSync(join(folders.modelsRoot, 'boats', 'tug.mpd'), 'utf8')).toBe('0 tug\n')
    expect(named.status).toBe(200)
    expect(existsSync(join(folders.modelsRoot, 'Ferry.ldr'))).toBe(false)
  })

  it('passes other requests on', async () => {
    // Arrange
    const folders = createFolders()

    // Act
    const other = await fetchFrom(folders, '/index.html')
    const similar = await fetchFrom(folders, `${PREFIX}/ldraw-other/a.ldr`)

    // Assert
    expect(other.status).toBe(418)
    expect(similar.status).toBe(418)
  })
})
