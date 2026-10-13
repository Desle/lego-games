import { HookKind, RacerPartKind } from './hd-coverage.types.ts'
import type { HookCall } from './hd-coverage.types.ts'
import { getMatchingCalls, getRacerPartIdentity } from './racer-part-classification.ts'

const CODES = ['VVCM', 'RRCM', 'CRCM', 'BVBCM']

const getCall = (key: string, wheelsKey: string | null): HookCall => ({
  id: 1,
  hook: wheelsKey === null ? HookKind.DRIVER : HookKind.CAR,
  key,
  wheelsKey,
  isModelPresent: true,
  isDrawingReturned: true,
  isFailed: false,
})

describe('getRacerPartIdentity', () => {
  it.each([
    ['GAMEDATA\\COMMON\\VVCM.GDB', 'GAMEDATA\\COMMON\\GHOST.WDB', 'ghostb2', 'body', 'VVCM'],
    ['GAMEDATA\\COMMON\\VVJMW.GDB', 'GAMEDATA\\COMMON\\GHOST.WDB', 'ghost2', 'wheels', 'VVJMW'],
    ['GAMEDATA\\COMMON\\VVPELVIS.GDB', 'GAMEDATA\\COMMON', 'vvpelvis', 'driver', 'VVPELVIS'],
    ['', 'MENUDATA\\PIECEDB', 'built', 'body', 'built car'],
    ['', 'MENUDATA\\PARTDB', 'built', 'driver', 'built figure'],
    ['MENUDATA\\CIRCUIT1\\CR_CAR.GDB', 'MENUDATA\\CIRCUIT1\\CIR1-01.WDB', 'cr_car', 'body', 'CRCM'],
    ['MENUDATA\\WINRRCAR\\RRCAR.GDB', 'MENUDATA\\WINRRCAR\\END.WDB', 'rrcar', 'body', 'RRCM'],
    ['MENUDATA\\C_AWARD1\\GUY1.GDB', 'MENUDATA\\C_AWARD1\\1STPLACE.WDB', 'guy1', 'driver', 'GUY1'],
    [
      'GAMEDATA\\COMMON\\DMISSILE.GDB',
      'GAMEDATA\\COMMON\\POWERUP.WDB',
      'dmissil',
      'power_up',
      'DMISSILE',
    ],
    [
      'GAMEDATA\\COMMON\\PUBRICKY.GDB',
      'GAMEDATA\\COMMON\\POWERUP.WDB',
      'gen',
      'power_up',
      'PUBRICKY',
    ],
  ])('reads %s as a racer part', (meshPath, worldPath, instanceName, kind, key) => {
    // Arrange
    const source = { meshPath, worldPath, instanceName }

    // Act
    const identity = getRacerPartIdentity(source, CODES)

    // Assert
    expect(identity).toEqual({ kind, key })
  })

  it.each([
    ['GAMEDATA\\RACEC0R0\\TRACK.GDB', 'GAMEDATA\\RACEC0R0\\RACEC0R0.WDB', 'track'],
    ['MENUDATA\\WINCAR\\CARBODY.GDB', 'MENUDATA\\WINCAR\\WINCAR.WDB', 'carbody'],
    ['MENUDATA\\RS_SET\\CARP.GDB', 'MENUDATA\\RS_SET\\RACER.WDB', 'carp'],
  ])('reads %s as no racer', (meshPath, worldPath, instanceName) => {
    // Arrange
    const source = { meshPath, worldPath, instanceName }

    // Act
    const identity = getRacerPartIdentity(source, CODES)

    // Assert
    expect(identity).toBeNull()
  })
})

describe('getMatchingCalls', () => {
  it('matches a champion body by its code, wheels by their model and a figure by its part bytes', () => {
    // Arrange
    const car = getCall('VVCM', 'VVJMW')
    const design = getCall('design:crchas0', 'CRJMW')
    const figure = getCall('parts:4 4 24 10 5', null)
    const calls = [car, design, figure]

    // Act
    const matches = [
      getMatchingCalls({ kind: RacerPartKind.BODY, key: 'VVCM' }, calls),
      getMatchingCalls({ kind: RacerPartKind.WHEELS, key: 'CRJMW' }, calls),
      getMatchingCalls({ kind: RacerPartKind.BODY, key: 'built car' }, calls),
      getMatchingCalls({ kind: RacerPartKind.DRIVER, key: 'built figure' }, calls),
    ]

    // Assert
    expect(matches).toEqual([[car], [design], [design], [figure]])
  })
})
