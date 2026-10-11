import { drawRandomValue } from '../../../random-table/index.ts'
import type { RandomTable } from '../../../random-table/index.ts'
import { DRIVER_PARTS } from '../../types/driver-session/driver-session.ts'
import type {
  DriverChooser,
  DriverMixResult,
  DriverPart,
  DriverPartAvailability,
  DriverSession,
} from '../../types/driver-session/driver-session.types.ts'
import type { BodyPartCatalog } from '../../types/figure-builder.types.ts'

const getRequirements = (catalog: BodyPartCatalog, part: DriverPart): readonly number[] => {
  switch (part) {
    case 'hat':
      return catalog.hats.map((entry) => entry.value)
    case 'face':
      return catalog.heads.entries.map((entry) => entry.value)
    case 'torso':
      return catalog.torsos.entries.map((entry) => entry.value)
    case 'legs':
      return catalog.legs.entries.map((entry) => entry.value)
  }
}

// 0x00483c60: a part is offered when it is the driver's own (0x0042b330) or when its requirement byte is met.
const getChooser = (
  catalog: BodyPartCatalog,
  part: DriverPart,
  currentIndex: number,
  isAvailable: DriverPartAvailability
): DriverChooser => {
  const indices = getRequirements(catalog, part).flatMap((requirement, index) =>
    index === currentIndex || isAvailable(requirement) ? [index] : []
  )
  return Object.freeze({ indices: Object.freeze(indices), position: indices.indexOf(currentIndex) })
}

// The editor opens on the racer's own parts (the five bytes `getDriverPartBytes` gives: hat, face, torso, legs, expression).
export const createDriverSession = (
  catalog: BodyPartCatalog,
  partBytes: readonly number[],
  isAvailable: DriverPartAvailability
): DriverSession => {
  const [hat = 0, face = 0, torso = 0, legs = 0, expression = 0] = partBytes
  return Object.freeze({
    hat: getChooser(catalog, 'hat', hat, isAvailable),
    face: getChooser(catalog, 'face', face, isAvailable),
    torso: getChooser(catalog, 'torso', torso, isAvailable),
    legs: getChooser(catalog, 'legs', legs, isAvailable),
    expression,
  })
}

// The catalogue index a chooser shows.
export const getDriverChoice = (session: DriverSession, part: DriverPart): number =>
  session[part].indices[session[part].position] ?? 0

// The five bytes the figure builder takes (0x0049db90): hat, face, torso, legs and the expression.
export const getDriverSessionPartBytes = (session: DriverSession): readonly number[] =>
  Object.freeze([...DRIVER_PARTS.map((part) => getDriverChoice(session, part)), session.expression])

const getSessionWith = (
  session: DriverSession,
  part: DriverPart,
  chooser: DriverChooser
): DriverSession => Object.freeze({ ...session, [part]: chooser })

// The arrows of a chooser. **Hypothesis**: the list wraps (the original's choosers select an index of their list, 0x0046c9a0).
export const moveDriverChooser = (
  session: DriverSession,
  part: DriverPart,
  step: number
): DriverSession => {
  const { indices, position } = session[part]
  const count = indices.length
  if (count === 0) return session
  return getSessionWith(
    session,
    part,
    Object.freeze({ indices, position: (((position + step) % count) + count) % count })
  )
}

// The mix button (0x0047dbf0): each chooser takes `table[++cursor] % count`, hat first, then face, torso and legs; the cursor
// is the game's shared random position, which the race goes on from.
export const mixDriver = (
  session: DriverSession,
  table: RandomTable,
  randomPosition: number
): DriverMixResult =>
  DRIVER_PARTS.reduce<DriverMixResult>(
    (result, part) => {
      const { indices } = result.session[part]
      if (indices.length === 0) return result
      const draw = drawRandomValue(table, result.randomPosition)
      return {
        session: getSessionWith(
          result.session,
          part,
          Object.freeze({ indices, position: draw.value % indices.length })
        ),
        randomPosition: draw.position,
      }
    },
    { session, randomPosition }
  )

// 0x0049db90: the menu's body model is chosen by the torso's and the legs' types (a hook torso is type 1, peg legs are
// type 1): `torso type + legs type * 2` indexes the catalogue's body models `rr hr rp hp`.
export const getBodyModelIndex = (catalog: BodyPartCatalog, partBytes: readonly number[]): number =>
  (catalog.torsos.entries[partBytes[2] ?? 0]?.type ?? 0) +
  (catalog.legs.entries[partBytes[3] ?? 0]?.type ?? 0) * 2
