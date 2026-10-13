import { multiplyRotations, rotateVector } from '../builder-document/builder-document.ts'
import { cleanRotation } from '../builder-rotation/builder-rotation.ts'
import { addVectors, getVectorDifference } from '../builder-vectors/builder-vectors.ts'
import { ConnectionKind } from '../builder-connections/builder-connections.types.ts'
import type {
  ConnectedPart,
  PartConnection,
} from '../builder-connections/builder-connections.types.ts'
import type {
  ConnectionSnap,
  ConnectionSnapOptions,
  PlacedConnection,
  ScoredSnap,
} from './builder-connection-snap.types.ts'
import type { BuilderPart, BuilderPartLine, Vector } from '../../types/building.types.ts'

const ALIGNED = 0.99
const SAME_TURN = 0.001
const ON_GROUND = 0.5
const KEY_PRECISION = 1
// Connections at different depths can meet on the screen: of those, the nearer in the model wins (pixels per LDraw unit apart).
const DEPTH_WEIGHT = 0.25

const getTransposed = (rotation: readonly number[]): readonly number[] =>
  [0, 3, 6, 1, 4, 7, 2, 5, 8].map((index) => rotation[index] ?? 0)

const getDot = (first: Vector, second: Vector): number =>
  first[0] * second[0] + first[1] * second[1] + first[2] * second[2]

const placeConnection = (
  part: BuilderPartLine,
  connection: PartConnection,
  partIndex: number
): PlacedConnection => ({
  connection,
  partIndex,
  position: addVectors(part.position, rotateVector(part.rotation, connection.position)),
  direction: rotateVector(part.rotation, connection.direction),
  rotation: multiplyRotations(part.rotation, connection.rotation),
})

const getPlaced = (parts: readonly ConnectedPart[]): readonly PlacedConnection[] =>
  parts.flatMap((entry, partIndex) =>
    entry.connections.map((connection) => placeConnection(entry.part, connection, partIndex))
  )

const getKey = (placed: PlacedConnection): string =>
  [placed.connection.kind, ...placed.position.map((value) => value.toFixed(KEY_PRECISION))].join(
    ' '
  )

// The connections of the standing parts that already hold their mate (a stud in a brick's bottom, a head on the neck); both legs
// share the hip axle.
const getOccupiedKeys = (placed: readonly PlacedConnection[]): ReadonlySet<string> => {
  const males = new Map<string, readonly PlacedConnection[]>()
  for (const entry of placed.filter((candidate) => candidate.connection.isMale)) {
    males.set(getKey(entry), [...(males.get(getKey(entry)) ?? []), entry])
  }
  const occupied = placed
    .filter((entry) => !entry.connection.isMale && entry.connection.kind !== ConnectionKind.LEG)
    .filter((female) =>
      (males.get(getKey(female)) ?? []).some(
        (male) =>
          male.partIndex !== female.partIndex && getDot(male.direction, female.direction) > ALIGNED
      )
    )
    .map(getKey)
  return new Set(occupied)
}

const getIsTurnSame = (first: readonly number[], second: readonly number[]) =>
  first.every((value, index) => Math.abs(value - (second[index] ?? 0)) < SAME_TURN)

// Where a moving part goes to join one of its connections to a standing one: a stud keeps the part's turn (it must point the same
// way); another joint turns the part so both frames meet.
const getJoinedPlacement = (
  part: BuilderPartLine,
  moving: PartConnection,
  standing: PlacedConnection
): BuilderPartLine | null => {
  if (moving.kind === ConnectionKind.STUD) {
    const direction = rotateVector(part.rotation, moving.direction)
    if (getDot(direction, standing.direction) < ALIGNED) return null
    const at = rotateVector(part.rotation, moving.position)
    return { ...part, position: getVectorDifference(standing.position, at) }
  }
  const rotation = cleanRotation(
    multiplyRotations(standing.rotation, getTransposed(moving.rotation))
  )
  const at = rotateVector(rotation, moving.position)
  return { ...part, rotation, position: getVectorDifference(standing.position, at) }
}

const getDistance = (first: readonly [number, number], second: readonly [number, number]) =>
  Math.hypot(first[0] - second[0], first[1] - second[1])

// How near a connection comes to a standing one on the screen; a minifigure joint also counts the cursor pointing at it (a hand is
// small: pointing at the wrist is easier than lining up its pin).
const getScreenDistance = (
  connection: PartConnection,
  screen: readonly [number, number],
  standingScreen: readonly [number, number],
  pointer: readonly [number, number] | null
): number =>
  connection.kind === ConnectionKind.STUD || pointer === null
    ? getDistance(screen, standingScreen)
    : Math.min(getDistance(screen, standingScreen), getDistance(pointer, standingScreen))

// The join nearest on the screen between a connection of the moving parts (where they are now) and a free, matching connection of the
// standing ones (a stud and a receptacle, a neck and a head…), within the radius; null when none is near. Several moving parts move
// together and keep their turns.
export const findConnectionSnap = (
  moving: readonly ConnectedPart[],
  standing: readonly ConnectedPart[],
  options: ConnectionSnapOptions
): ConnectionSnap | null => {
  const standingPlaced = getPlaced(standing)
  const occupied = getOccupiedKeys(standingPlaced)
  const free = standingPlaced
    .filter((entry) => !occupied.has(getKey(entry)))
    .filter(
      (entry) =>
        entry.connection.isMale ||
        entry.connection.kind !== ConnectionKind.STUD ||
        entry.position[1] < options.groundHeight - ON_GROUND
    )
    .map((entry) => ({ entry, screen: options.project(entry.position) }))
  const isTurnAllowed = options.isTurnAllowed && moving.length === 1
  const candidates = moving.flatMap((movingPart) =>
    movingPart.connections.flatMap((connection) => {
      const placed = placeConnection(movingPart.part, connection, -1)
      const screen = options.project(placed.position)
      return free
        .filter(
          ({ entry }) =>
            entry.connection.kind === connection.kind &&
            entry.connection.isMale !== connection.isMale
        )
        .map(({ entry, screen: standingScreen }) => {
          const distance = getScreenDistance(connection, screen, standingScreen, options.pointer)
          return {
            entry,
            connection,
            distance,
            score:
              distance +
              DEPTH_WEIGHT * Math.hypot(...getVectorDifference(placed.position, entry.position)),
          }
        })
        .filter((candidate) => candidate.distance <= options.radius)
        .map((candidate) => {
          const joined = getJoinedPlacement(movingPart.part, candidate.connection, candidate.entry)
          if (joined === null) return null
          const isTurned = !getIsTurnSame(joined.rotation, movingPart.part.rotation)
          if (isTurned && !isTurnAllowed) return null
          const offset = getVectorDifference(joined.position, movingPart.part.position)
          if (!options.getIsOffsetAllowed(offset)) return null
          return Object.freeze({
            offset,
            rotation: isTurned ? joined.rotation : null,
            target: candidate.entry.position,
            kind: candidate.connection.kind,
            distance: candidate.distance,
            score: candidate.score,
          })
        })
        .filter((snap): snap is ScoredSnap => snap !== null)
    })
  )
  const nearest = candidates.reduce<ScoredSnap | null>(
    (best, candidate) => (best === null || candidate.score < best.score ? candidate : best),
    null
  )
  return nearest === null
    ? null
    : Object.freeze({
        offset: nearest.offset,
        rotation: nearest.rotation,
        target: nearest.target,
        kind: nearest.kind,
        distance: nearest.distance,
      })
}

// The chosen parts moved (and the one turned) as a snap says.
export const applyConnectionSnap = (
  parts: readonly BuilderPart[],
  indices: readonly number[],
  snap: ConnectionSnap
): readonly BuilderPart[] =>
  parts.map((part, index) =>
    indices.includes(index)
      ? Object.freeze({
          ...part,
          position: addVectors(part.position, snap.offset),
          rotation: snap.rotation ?? part.rotation,
        })
      : part
  )
