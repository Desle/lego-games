import {
  findDriverRecord,
  getIsPlainHead,
  getIsPlainTorso,
  parseDriverFile,
} from './driver-file.ts'

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

  it('knows a part with no ROLE line by its number', () => {
    // Arrange
    const text = [...HEADER, '1 4 -15.552 -23 0 1 0 0 0 1 0 0 0 1 3818.dat'].join('\n')

    // Act
    const roles = parseDriverFile(text).map((entry) => entry.role)

    // Assert
    expect(roles).toEqual(['right-arm'])
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
