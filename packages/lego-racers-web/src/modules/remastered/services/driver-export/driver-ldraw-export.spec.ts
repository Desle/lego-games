import { parseBuilderDocument } from '../ldraw-builder/builder-document.ts'
import { LDRAW_HATS } from '../ldraw-racer/ldraw-minifig-parts.ts'
import type { MinifigSpec } from '../ldraw-racer/minifig-spec.types.ts'
import { getDriverLDrawText, getNearestBrickColorCode } from './driver-ldraw-export.ts'
import { DriverPartRole } from './driver-export.types.ts'

const RACING_HELMET_INDEX = 1
const ROLE_PREFIX = '0 !RACERS ROLE '
const GUESS_PREFIX = '0 !RACERS GUESS '

// A driver in the black racing helmet and its visor, with no library print: a plain head, torso and legs in the game's colours.
const createSpec = (): MinifigSpec => ({
  partBytes: [RACING_HELMET_INDEX, 0, 0, 0, 0],
  hats: LDRAW_HATS[RACING_HELMET_INDEX]?.hats ?? [],
  face: null,
  torso: null,
  legs: null,
  isHookTorso: false,
  surfaces: {
    skinColor: 0xffdf00,
    torsoColor: 0xda1f1f,
    armColors: { left: 0xda1f1f, right: 0xda1f1f },
    handColors: { left: 0xffdf00, right: 0xffdf00 },
    hipsColor: 0x2d2d2d,
    legsColor: 0x0000ff,
    face: null,
    torso: null,
  },
})

const getRoles = (text: string): readonly string[] =>
  parseBuilderDocument(text).parts.flatMap((part) =>
    part.commentLines
      .filter((line) => line.startsWith(ROLE_PREFIX))
      .map((line) => line.slice(ROLE_PREFIX.length))
  )

describe('getDriverLDrawText', () => {
  it('names every role of the figure exactly once, each on a part the builder reads', () => {
    // Arrange
    const text = getDriverLDrawText('FIXTURE', createSpec())

    // Act
    const roles = getRoles(text)

    // Assert
    expect([...roles].sort()).toEqual(Object.values(DriverPartRole).sort())
    expect(parseBuilderDocument(text).keptLines).toEqual([])
  })

  it('keeps the standard header and the guess confidence of every part', () => {
    // Arrange
    const text = getDriverLDrawText('FIXTURE', createSpec())

    // Act
    const document = parseBuilderDocument(text)

    // Assert
    expect(document.headerLines.slice(0, 5)).toEqual([
      '0 FIXTURE driver',
      '0 Name: FIXTURE.ldr',
      '0 Author: Claude for desle',
      '0 !LDRAW_ORG Unofficial_Model',
      '0 BFC CERTIFY CCW',
    ])
    expect(
      document.parts.every(
        (part) => part.commentLines.filter((line) => line.startsWith(GUESS_PREFIX)).length === 1
      )
    ).toBe(true)
  })

  it('places the parts in the standing rest pose about the top of the hips', () => {
    // Arrange
    const text = getDriverLDrawText('FIXTURE', createSpec())

    // Act
    const placements = parseBuilderDocument(text).parts.map(
      (part) => `${part.partName} ${String(part.colorCode)} ${part.position.join(' ')}`
    )

    // Assert
    expect(placements).toEqual([
      '3815b.dat 0 0 0 0',
      '3817b.dat 1 0 12 0',
      '3816b.dat 1 0 12 0',
      '973.dat 4 0 -32 0',
      '3626b.dat 14 0 -56 0',
      '3842a.dat 0 0 -56 0',
      '2447.dat 40 0 -56 0',
      '3819.dat 4 15.552 -23 0',
      '3820.dat 14 23.69 -5.226 -9.898',
      '3818.dat 4 -15.552 -23 0',
      '3820.dat 14 -23.69 -5.226 -9.898',
    ])
  })
})

describe('getNearestBrickColorCode', () => {
  it('turns a colour of the game pictures into the nearest brick colour', () => {
    // Arrange / Act
    const code = getNearestBrickColorCode(0xffdf00)

    // Assert
    expect(code).toBe(14)
  })

  it('turns a dark grey into black by its lightness, not into brown', () => {
    // Arrange / Act
    const code = getNearestBrickColorCode(0x2d2d2d)

    // Assert
    expect(code).toBe(0)
  })
})
