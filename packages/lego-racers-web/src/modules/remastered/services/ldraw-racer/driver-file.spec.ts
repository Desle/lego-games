import {
  findDriverRecord,
  getIsPlainHead,
  getIsPlainTorso,
  getMinifigPartKey,
  parseDriverFile,
} from './driver-file.ts'
import { DriverPartRole } from './driver-file.types.ts'
import { MinifigPartKey } from './minifig-assembly.types.ts'

const HEADER = ['0 RR driver', '0 Name: RR.ldr', '0 BFC CERTIFY CCW', '']

const WITH_ROLES = [
  ...HEADER,
  '0 // hips',
  '0 !RACERS ROLE hips',
  '0 !RACERS GUESS close',
  '1 71 0 0 0 1 0 0 0 1 0 0 0 1 3815b.dat',
  '0 // head',
  '0 !RACERS ROLE head',
  '0 !RACERS GUESS exact',
  '1 14 0 -56 0 1 0 0 0 1 0 0 0 1 3626cp40.dat',
  '0 !RACERS ROLE hat',
  '1 0 0 -56 0 1 0 0 0 1 0 0 0 1 3842a.dat',
  '0 !RACERS ROLE accessory',
  '1 40 0 -56 0 1 0 0 0 1 0 0 0 1 2447.dat',
  // A role the file states wins over the part's number.
  '0 !RACERS ROLE right-hand',
  '1 0 23.69 -5.226 -9.898 1 0 0 0 1 0 0 0 1 3820.dat',
].join('\n')

const WITHOUT_ROLES = [
  ...HEADER,
  '1 71 0 0 0 1 0 0 0 1 0 0 0 1 3815b.dat',
  '1 71 0 12 0 1 0 0 0 1 0 0 0 1 3817b.dat',
  '1 71 0 12 0 1 0 0 0 1 0 0 0 1 3816b.dat',
  '1 7 0 -32 0 1 0 0 0 1 0 0 0 1 973p01.dat',
  '1 14 0 -56 0 1 0 0 0 1 0 0 0 1 3626b.dat',
  '1 0 0 -56 0 1 0 0 0 1 0 0 0 1 3842a.dat',
  '1 4 15.552 -23 0 1 0 0 0 1 0 0 0 1 3819.dat',
  '1 4 -15.552 -23 0 1 0 0 0 1 0 0 0 1 3818.dat',
  '1 14 23.69 -5.226 -9.898 1 0 0 0 1 0 0 0 1 3820.dat',
  '1 8 -23.69 -5.226 -9.898 1 0 0 0 1 0 0 0 1 2531.dat',
  // Something held at the chest that is no minifigure part.
  '1 15 0 -20 -12 1 0 0 0 1 0 0 0 1 3069b.dat',
].join('\n')

describe('parseDriverFile', () => {
  it('takes each part role from the RACERS ROLE line before it', () => {
    // Arrange
    const text = WITH_ROLES

    // Act
    const parts = parseDriverFile(text)

    // Assert
    expect(parts.map((entry) => `${entry.role} ${entry.part.partName}`)).toEqual([
      'hips 3815b.dat',
      'head 3626cp40.dat',
      'hat 3842a.dat',
      'accessory 2447.dat',
      'right-hand 3820.dat',
    ])
    expect(parts[1]?.part.colorCode).toBe(14)
  })

  it('recognises the minifigure parts by number, and a sided part by its side, when there are no ROLE lines', () => {
    // Arrange
    const text = WITHOUT_ROLES

    // Act
    const roles = parseDriverFile(text).map((entry) => entry.role)

    // Assert
    expect(roles).toEqual([
      DriverPartRole.HIPS,
      DriverPartRole.LEFT_LEG,
      DriverPartRole.RIGHT_LEG,
      DriverPartRole.TORSO,
      DriverPartRole.HEAD,
      DriverPartRole.HAT,
      DriverPartRole.LEFT_ARM,
      DriverPartRole.RIGHT_ARM,
      DriverPartRole.LEFT_HAND,
      DriverPartRole.RIGHT_HAND,
      DriverPartRole.TORSO,
    ])
  })

  it('puts the hat and its accessory on the head', () => {
    // Arrange
    const roles = [DriverPartRole.HEAD, DriverPartRole.HAT, DriverPartRole.ACCESSORY]

    // Act
    const keys = roles.map(getMinifigPartKey)

    // Assert
    expect(keys).toEqual([MinifigPartKey.HEAD, MinifigPartKey.HEAD, MinifigPartKey.HEAD])
  })
})

describe('getIsPlainHead and getIsPlainTorso', () => {
  it('tells a part with no print from a printed one', () => {
    // Arrange
    const heads = ['3626b.dat', '3626C.DAT', '3626cp40.dat', '3626bpa7.dat']
    const torsos = ['973.dat', '973pa7.dat', '76382.dat']

    // Act
    const plainHeads = heads.map(getIsPlainHead)
    const plainTorsos = torsos.map(getIsPlainTorso)

    // Assert
    expect(plainHeads).toEqual([true, true, false, false])
    expect(plainTorsos).toEqual([true, false, true])
  })
})

describe('findDriverRecord', () => {
  const drivers = [
    { name: 'RR', modelName: 'rrpelvis', partBytes: [1, 28, 15, 18, 0] },
    { name: 'BVB', modelName: 'vbpelvis', partBytes: [9, 21, 4, 9, 0] },
  ]

  it('finds a champion by the model of his race figure', () => {
    // Arrange / Act
    const record = findDriverRecord(drivers, 'VBPELVIS', null)

    // Assert
    expect(record).toEqual({ name: 'BVB', partBytes: [9, 21, 4, 9, 0] })
  })

  it('finds a figure by the parts its bytes choose, whatever its expression', () => {
    // Arrange / Act
    const record = findDriverRecord(drivers, null, [1, 28, 15, 18, 3])

    // Assert
    expect(record?.name).toBe('RR')
  })

  it('knows no figure the player built of other parts', () => {
    // Arrange / Act
    const record = findDriverRecord(drivers, null, [1, 28, 15, 17, 0])

    // Assert
    expect(record).toBeNull()
  })
})
