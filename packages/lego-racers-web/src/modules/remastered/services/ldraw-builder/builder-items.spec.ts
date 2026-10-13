import {
  getBuilderItemFile,
  getBuilderItems,
  getNextBuilderItem,
  getStartFiles,
} from './builder-items.ts'

describe('getBuilderItems', () => {
  it('queues the 12 chassis, then the 20 cars on their chassis', () => {
    // Arrange
    const championChassis = new Map([['RRCM', 'RRchas0']])

    // Act
    const items = getBuilderItems(championChassis)

    // Assert
    expect(items).toHaveLength(32)
    expect(items[0]?.id).toBe('chassis/jtchas0')
    expect(items.find((item) => item.id === 'RRCM')?.chassisName).toBe('rrchas0')
  })
})

describe('getBuilderItemFile', () => {
  it('keeps the case of a file already there and refuses unknown items', () => {
    // Arrange
    const existing = ['chassis/RRchas0.ldr', 'KKCM.mpd']

    // Act
    const files = ['chassis/rrchas0', 'chassis/jtchas0', 'KKCM', 'chassis/../x'].map((id) =>
      getBuilderItemFile(id, existing)
    )

    // Assert
    expect(files).toEqual(['chassis/RRchas0.ldr', 'chassis/JTCHAS0.ldr', 'KKCM.ldr', null])
  })
})

describe('getNextBuilderItem', () => {
  it('skips done items and wraps around', () => {
    // Arrange
    const items = getBuilderItems(new Map())
    const done = items.slice(1).map((item) => item.id)

    // Act
    const next = getNextBuilderItem(items, 'chassis/gm_chas0', done)

    // Assert
    expect(next?.id).toBe('chassis/jtchas0')
    expect(getNextBuilderItem(items, 'x', [...done, 'chassis/jtchas0'])).toBeNull()
  })
})

describe('getStartFiles', () => {
  it('offers a car its own files and every chassis recipe, a chassis only its own', () => {
    // Arrange
    const [chassis, car] = [getBuilderItems(new Map())[0], getBuilderItems(new Map()).at(-1)]
    const paths = [
      'GMCM.ldr',
      'drafts/GMCM-old.ldr',
      'chassis/JTchas0.ldr',
      'chassis/_fallback/x.ldr',
      'RRCM.ldr',
    ]

    // Act
    const carFiles = car === undefined ? [] : getStartFiles(car, paths)
    const chassisFiles = chassis === undefined ? [] : getStartFiles(chassis, paths)

    // Assert
    expect(carFiles).toEqual(['GMCM.ldr', 'drafts/GMCM-old.ldr', 'chassis/JTchas0.ldr'])
    expect(chassisFiles).toEqual(['chassis/JTchas0.ldr'])
  })
})
