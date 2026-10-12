import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { openJamArchive } from '@lego-games/lego-racers/jam-archive'
import { createMinifigSpec, getDriverPartBytes } from './minifig-spec.ts'

const JAM_PATH = resolve(
  import.meta.dirname,
  '../../../../../../../original-files/Lego_Racers_Win_Files_EN/Game Files/LEGO.JAM'
)
const isPresent = existsSync(JAM_PATH)
const ROCKET_RACER_BYTES = [1, 28, 15, 18, 0]
const CAPTAIN_BYTES = [4, 19, 24, 0, 0]
const PEG_LEG_BYTES = [0, 0, 0, 10, 0]
const YELLOW = 0xffdf00

describe.skipIf(!isPresent)('the minifigure of a driver', () => {
  const archive = isPresent ? openJamArchive(new Uint8Array(readFileSync(JAM_PATH))) : null

  it('finds a champion driver by his model name in the driver database', () => {
    // Arrange / Act
    const partBytes = archive === null ? null : getDriverPartBytes(archive, 'rrpelvis')

    // Assert
    expect(partBytes).toEqual(ROCKET_RACER_BYTES)
  })

  it('knows no driver by a name the database does not hold', () => {
    // Arrange / Act
    const partBytes = archive === null ? null : getDriverPartBytes(archive, 'nobody')

    // Assert
    expect(partBytes).toBeNull()
  })

  it('takes the hat from the catalogue and the skin from the face picture', () => {
    // Arrange / Act
    const spec = archive === null ? null : createMinifigSpec(archive, ROCKET_RACER_BYTES)

    // Assert
    expect([spec?.hat?.part, spec?.surfaces.skinColor]).toEqual(['3842a', YELLOW])
  })

  it('shows the face card and the front of the torso as pictures of the original', () => {
    // Arrange / Act
    const spec = archive === null ? null : createMinifigSpec(archive, ROCKET_RACER_BYTES)

    // Assert
    expect([spec?.surfaces.face?.bitmapPath, spec?.surfaces.torso?.bitmapPath]).toEqual([
      'MENUDATA\\PARTDB\\RR_DFLT.BMP',
      'MENUDATA\\PARTDB\\RR_CHST.BMP',
    ])
  })

  it('knows a hook torso and peg legs by their catalogue type', () => {
    // Arrange / Act
    const hook = archive === null ? null : createMinifigSpec(archive, CAPTAIN_BYTES)
    const peg = archive === null ? null : createMinifigSpec(archive, PEG_LEG_BYTES)

    // Assert
    expect([hook?.isHookTorso, peg?.isPegLegs]).toEqual([true, true])
  })
})
