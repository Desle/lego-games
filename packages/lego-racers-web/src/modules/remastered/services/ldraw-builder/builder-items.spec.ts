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
  it('offers a car every champion car, every chassis recipe and its own drafts, a chassis its own recipe and drafts', () => {
    // Arrange
    const [chassis, car] = [getBuilderItems(new Map())[0], getBuilderItems(new Map()).at(-1)]
    const paths = [
      'GMCM.ldr',
      'drafts/GMCM-old.ldr',
      'GMCM.ldr.bak',
      'chassis/JTchas0.ldr',
      'chassis/JTCHAS0-backup.ldr',
      'chassis/_fallback/x.ldr',
      'RRCM.ldr',
      'scratch.ldr',
    ]

    // Act
    const carGroups = car === undefined ? [] : getStartFiles(car, paths)
    const chassisGroups = chassis === undefined ? [] : getStartFiles(chassis, paths)

    // Assert
    expect(car?.name).toBe('GMCM')
    expect(carGroups).toEqual([
      { label: 'Cars', files: ['GMCM.ldr', 'RRCM.ldr'] },
      { label: 'Chassis', files: ['chassis/JTchas0.ldr', 'chassis/JTCHAS0-backup.ldr'] },
      { label: 'Backups/drafts', files: ['drafts/GMCM-old.ldr', 'GMCM.ldr.bak'] },
    ])
    expect(chassisGroups).toEqual([
      { label: 'Chassis', files: ['chassis/JTchas0.ldr'] },
      { label: 'Backups/drafts', files: ['chassis/JTCHAS0-backup.ldr'] },
    ])
  })
})
