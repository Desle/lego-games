import {
  collectModelText,
  findModelFile,
  getMissingModelNames,
  groupModelFiles,
  readModelFiles,
} from './model-files.ts'

const createFile = (path: string) => ({ path, modifiedMilliseconds: 1 })

describe('readModelFiles', () => {
  it('keeps the well-formed entries of files.json in their order', () => {
    // Arrange
    const answer = [
      { path: 'RRCM.ldr', modifiedMilliseconds: 1 },
      { path: 42 },
      'RRCM.ldr',
      { path: 'drivers/RR.ldr', modifiedMilliseconds: 2 },
    ]

    // Act
    const files = readModelFiles(answer)

    // Assert
    expect(files).toEqual([
      { path: 'RRCM.ldr', modifiedMilliseconds: 1 },
      { path: 'drivers/RR.ldr', modifiedMilliseconds: 2 },
    ])
  })

  it('is empty for an answer that is no list', () => {
    // Arrange
    const answer = { error: 'missing' }

    // Act
    const files = readModelFiles(answer)

    // Assert
    expect(files).toEqual([])
  })
})

describe('groupModelFiles', () => {
  it('lists the models folder first, then each subfolder by name', () => {
    // Arrange
    const files = [
      'drivers/RR.ldr',
      'RRCM.ldr',
      'chassis/rrchas0.ldr',
      'ACM.ldr',
      'drafts/a/b.mpd',
    ].map(createFile)

    // Act
    const folders = groupModelFiles(files)

    // Assert
    expect(
      folders.map(({ folder, files: folderFiles }) => [
        folder,
        folderFiles.map((file) => file.path),
      ])
    ).toEqual([
      ['/', ['RRCM.ldr', 'ACM.ldr']],
      ['chassis', ['chassis/rrchas0.ldr']],
      ['drafts/a', ['drafts/a/b.mpd']],
      ['drivers', ['drivers/RR.ldr']],
    ])
  })
})

describe('getMissingModelNames', () => {
  it('names each model file a model places once, leaving out parts and the files it holds', () => {
    // Arrange
    const text = [
      '0 FILE main.ldr',
      '1 16 0 0 0 1 0 0 0 1 0 0 0 1 rrchas0.ldr',
      '1 16 0 0 0 1 0 0 0 1 0 0 0 1 RRCHAS0.LDR',
      '1 4 0 0 0 1 0 0 0 1 0 0 0 1 3001.dat',
      '1 4 0 0 0 1 0 0 0 1 0 0 0 1 wheel.ldr',
      '0 FILE Wheel.ldr',
      '1 0 0 0 0 1 0 0 0 1 0 0 0 1 hub.mpd',
    ].join('\n')

    // Act
    const names = getMissingModelNames(text)

    // Assert
    expect(names).toEqual(['rrchas0.ldr', 'hub.mpd'])
  })
})

describe('findModelFile', () => {
  it('finds a file by name in any folder, without regard to case', () => {
    // Arrange
    const files = ['RRCM.ldr', 'chassis/RRchas0.ldr'].map(createFile)

    // Act
    const file = findModelFile(files, 'rrchas0.ldr')

    // Assert
    expect(file?.path).toBe('chassis/RRchas0.ldr')
  })
})

describe('collectModelText', () => {
  it('adds the model files a model places, at any depth, as sections named as the model names them', async () => {
    // Arrange
    const texts: Readonly<Record<string, string>> = {
      'RRCM.ldr':
        '1 16 0 0 0 1 0 0 0 1 0 0 0 1 rrchas0.ldr\n1 4 0 0 0 1 0 0 0 1 0 0 0 1 missing.ldr',
      'chassis/RRchas0.ldr': '1 16 0 0 0 1 0 0 0 1 0 0 0 1 deck.ldr',
      'chassis/deck.ldr': '1 4 0 0 0 1 0 0 0 1 0 0 0 1 3001.dat',
    }
    const files = Object.keys(texts).map(createFile)

    // Act
    const text = await collectModelText('RRCM.ldr', files, (path) =>
      Promise.resolve(texts[path] ?? null)
    )

    // Assert
    expect(text).toBe(
      [
        texts['RRCM.ldr'],
        '0 FILE rrchas0.ldr',
        texts['chassis/RRchas0.ldr'],
        '0 FILE deck.ldr',
        texts['chassis/deck.ldr'],
      ].join('\n')
    )
  })

  it('is null when the model itself cannot be read', async () => {
    // Arrange
    const files = [createFile('gone.ldr')]

    // Act
    const text = await collectModelText('gone.ldr', files, () => Promise.resolve(null))

    // Assert
    expect(text).toBeNull()
  })
})
