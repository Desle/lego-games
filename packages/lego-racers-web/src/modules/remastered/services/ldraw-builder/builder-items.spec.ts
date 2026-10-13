import {
  getBuilderItemFile,
  getBuilderItems,
  getNextBuilderItem,
  getStartFiles,
} from './builder-items.ts'

describe('getBuilderItems', () => {
  it('queues the 12 chassis, then the 20 cars on their chassis, then the 24 drivers, the 24 power-up objects and the 11 particles', () => {
    // Arrange
    const championChassis = new Map([['RRCM', 'RRchas0']])

    // Act
    const items = getBuilderItems(championChassis)

    // Assert
    expect(items).toHaveLength(91)
    expect(items[0]?.id).toBe('chassis/jtchas0')
    expect(items.find((item) => item.id === 'RRCM')?.chassisName).toBe('rrchas0')
    expect(items.find((item) => item.id === 'drivers/GM')?.kind).toBe('driver')
    expect(items.find((item) => item.id === 'powerups/ENHANER')?.kind).toBe('power_up')
    expect(items.at(-1)).toEqual({
      id: 'particles/SNOW',
      kind: 'particle',
      name: 'SNOW',
      chassisName: '',
    })
    expect(items.at(-11)).toEqual({
      id: 'particles/SMOKE',
      kind: 'particle',
      name: 'SMOKE',
      chassisName: '',
    })
  })
})

describe('getBuilderItemFile', () => {
  it('keeps the case of a file already there and refuses unknown items', () => {
    // Arrange
    const existing = ['chassis/RRchas0.ldr', 'KKCM.mpd', 'drivers/bvb.ldr']

    // Act
    const files = [
      'chassis/rrchas0',
      'chassis/jtchas0',
      'KKCM',
      'chassis/../x',
      'drivers/BVB',
      'drivers/RR',
      'drivers/NOBODY',
      'powerups/DMISSILE',
      'powerups/PUBRICKY',
      'particles/WHITE_SMOKE',
      'particles/LAVA',
    ].map((id) => getBuilderItemFile(id, existing))

    // Assert
    expect(files).toEqual([
      'chassis/RRchas0.ldr',
      'chassis/JTCHAS0.ldr',
      'KKCM.ldr',
      null,
      'drivers/bvb.ldr',
      'drivers/RR.ldr',
      null,
      'powerups/DMISSILE.ldr',
      null,
      'particles/WHITE_SMOKE.ldr',
      null,
    ])
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
    const [chassis, car] = [
      getBuilderItems(new Map())[0],
      getBuilderItems(new Map()).find((item) => item.id === 'GMCM'),
    ]
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

describe('getStartFiles for a driver', () => {
  it('offers every driver file and only its own drafts', () => {
    // Arrange
    const driver = getBuilderItems(new Map()).find((item) => item.id === 'drivers/BB')
    const paths = [
      'BBCM.ldr',
      'chassis/BBCHAS0.ldr',
      'drivers/BB.ldr',
      'drivers/BVB.ldr',
      'drafts/BB-old.ldr',
      'drafts/backups/BB-2026.ldr',
      'drafts/BBCM-old.ldr',
    ]

    // Act
    const groups = driver === undefined ? [] : getStartFiles(driver, paths)

    // Assert
    expect(groups).toEqual([
      { label: 'Drivers', files: ['drivers/BB.ldr', 'drivers/BVB.ldr'] },
      { label: 'Backups/drafts', files: ['drafts/BB-old.ldr', 'drafts/backups/BB-2026.ldr'] },
    ])
  })
})

describe('getStartFiles for a power-up object', () => {
  it('offers every power-up object file and only its own drafts', () => {
    // Arrange
    const rocket = getBuilderItems(new Map()).find((item) => item.id === 'powerups/DMISSILE')
    const paths = [
      'powerups/DMISSILE.ldr',
      'powerups/BARREL.ldr',
      'drafts/DMISSILE-long.ldr',
      'drafts/DMISSILEX.ldr',
      'DMISSILE.ldr',
    ]

    // Act
    const groups = rocket === undefined ? [] : getStartFiles(rocket, paths)

    // Assert
    expect(groups).toEqual([
      { label: 'Power-ups', files: ['powerups/DMISSILE.ldr', 'powerups/BARREL.ldr'] },
      { label: 'Backups/drafts', files: ['drafts/DMISSILE-long.ldr'] },
    ])
  })
})
