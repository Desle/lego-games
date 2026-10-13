import { HookKind, RacerPartKind } from './hd-coverage.types.ts'
import type { HookCall, InstanceSource, RacerPartIdentity } from './hd-coverage.types.ts'

// The mesh builder's models have no file: the car builder's (`loadBuiltCarScene`) in the brick folder, the figure builder's
// (`loadMenuDriverScene`, `loadBuiltDriverScene`) in the part folder.
const BUILT_MESH_NAME = 'built'
const BRICK_WORLD_PATH = 'MENUDATA\\PIECEDB'
const PART_WORLD_PATH = 'MENUDATA\\PARTDB'
const WHEEL_MODEL_SUFFIX = 'JMW'
const DRIVER_MODEL_SUFFIX = 'PELVIS'
const MENU_DIRECTORY_PREFIX = 'MENUDATA\\'
// The full-screen cinemas draw racers of their own worlds: the champions' cars (`CR_CAR.GDB`, `RRCAR.GDB`: a champion's code
// before `CAR`) and figures (skeletons of 29 to 41 bones, read off every cinema world of `MENUDATA`).
const CINEMA_CAR_PATTERN = /^(.+?)_?CAR$/
const CINEMA_FIGURE_STEMS: readonly string[] = [
  'GUY1',
  'GUY02',
  'DUMMY01',
  'GMDUM',
  'RRDUM',
  'VV',
  'RR1',
]
const CHAMPION_CAR_SUFFIX = 'CM'
export const BUILT_CAR_KEY = 'built car'
export const BUILT_FIGURE_KEY = 'built figure'
export const DESIGN_KEY_PREFIX = 'design:'
export const PARTS_KEY_PREFIX = 'parts:'

const getFileStem = (path: string): string =>
  (path.split('\\').at(-1) ?? '').replace(/\.[^.]*$/, '').toUpperCase()

const getCinemaRacerIdentity = (
  stem: string,
  championCarCodes: readonly string[]
): RacerPartIdentity | null => {
  if (CINEMA_FIGURE_STEMS.includes(stem)) return { kind: RacerPartKind.DRIVER, key: stem }
  const code = `${CINEMA_CAR_PATTERN.exec(stem)?.[1] ?? ''}${CHAMPION_CAR_SUFFIX}`
  return championCarCodes.includes(code) ? { kind: RacerPartKind.BODY, key: code } : null
}

// Which racer part an original mesh is, from the file it was read from: a champion's body (`VVCM.GDB`), a chassis's wheels
// (`*JMW.GDB`), a champion's race driver (`*PELVIS.GDB`), a model the builders made, or a cinema's own car or figure. Null for
// anything else (the track, the menus' sets).
export const getRacerPartIdentity = (
  source: InstanceSource,
  championCarCodes: readonly string[]
): RacerPartIdentity | null => {
  if (source.meshPath === '' && source.instanceName === BUILT_MESH_NAME) {
    const worldPath = source.worldPath.toUpperCase()
    if (worldPath === BRICK_WORLD_PATH) return { kind: RacerPartKind.BODY, key: BUILT_CAR_KEY }
    if (worldPath.startsWith(PART_WORLD_PATH))
      return { kind: RacerPartKind.DRIVER, key: BUILT_FIGURE_KEY }
    return null
  }
  const stem = getFileStem(source.meshPath)
  if (stem === '') return null
  if (source.meshPath.toUpperCase().startsWith(MENU_DIRECTORY_PREFIX)) {
    return getCinemaRacerIdentity(stem, championCarCodes)
  }
  if (championCarCodes.includes(stem)) return { kind: RacerPartKind.BODY, key: stem }
  if (stem.endsWith(WHEEL_MODEL_SUFFIX)) return { kind: RacerPartKind.WHEELS, key: stem }
  if (stem.endsWith(DRIVER_MODEL_SUFFIX)) return { kind: RacerPartKind.DRIVER, key: stem }
  return null
}

// The calls of a place that asked for the racer part an original mesh is.
export const getMatchingCalls = (
  identity: RacerPartIdentity,
  calls: readonly HookCall[]
): readonly HookCall[] =>
  calls.filter((call) => {
    if (identity.kind === RacerPartKind.PARTICLE)
      return call.hook === HookKind.PARTICLE && call.key === identity.key
    if (identity.kind === RacerPartKind.WHEELS) return call.wheelsKey === identity.key
    if (identity.key === BUILT_CAR_KEY) return call.key.startsWith(DESIGN_KEY_PREFIX)
    if (identity.key === BUILT_FIGURE_KEY) return call.key.startsWith(PARTS_KEY_PREFIX)
    return call.key === identity.key
  })
