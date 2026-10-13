import { multiplyRotations, rotateVector } from '../builder-document/builder-document.ts'
import { PART_UP } from '../builder-rotation/builder-rotation.ts'
import { STUD_WIDTH } from '../ldraw-units/ldraw-units.constants.ts'
import { ConnectionKind } from './builder-connections.types.ts'
import type { PartShape } from '../builder-studs/builder-studs.types.ts'
import type { MinifigConnectionEntry, PartConnection } from './builder-connections.types.ts'
import type { BuilderBox, Vector } from '../../types/building.types.ts'

const IDENTITY: readonly number[] = Object.freeze([1, 0, 0, 0, 1, 0, 0, 0, 1])
const HALF_STUD = STUD_WIDTH / 2
const UPWARD = 0.99
const SAME_LEVEL = 0.5
const ORIGIN: Vector = [0, 0, 0]

// The library's complete figures stack the parts so: the torso 32 above the top of the hips, the head 24 above the torso, the legs on
// the hip axle 12 below; `973c01` puts the arms at (±15.552, 9) of the torso, turned 9.78 degrees onto its slanted sides, and the
// hands where `HANDS` says (in the torso's frame; a hand's pin is its own z axis).
const TORSO_ON_HIPS = 32
const HEAD_ON_TORSO = 24
const HIP_AXLE = 12
const SHOULDER: Vector = [15.552, 9, 0]
const ARM_COSINE = 0.985467
const ARM_SINE = 0.169866
const LEFT_ARM_TURN: readonly number[] = [
  ARM_COSINE,
  ARM_SINE,
  0,
  -ARM_SINE,
  ARM_COSINE,
  0,
  0,
  0,
  1,
]
const RIGHT_ARM_TURN: readonly number[] = [
  ARM_COSINE,
  -ARM_SINE,
  0,
  ARM_SINE,
  ARM_COSINE,
  0,
  0,
  0,
  1,
]
const LEFT_HAND_TURN: readonly number[] = [
  0.985, 0.1202, -0.1202, -0.17, 0.6964, -0.6964, 0, 0.707, 0.707,
]
const RIGHT_HAND_TURN: readonly number[] = [
  0.985, -0.1202, 0.1202, 0.17, 0.6964, -0.6964, 0, 0.707, 0.707,
]
const LEFT_HAND_AT: Vector = [23.6904, 26.774, -9.8982]
// `3820`'s clip: a bar of radius 4 between (0, 4.502, -8.518) and (0, -6.148, -11.272); a tool's handle runs along its own y through
// its origin (the library's convention for minifigure tools), its head (the top, -y) out of the top of the fist.
const GRIP_AT: Vector = [0, -0.823, -9.895]
const GRIP_COSINE = 0.9682
const GRIP_SINE = 0.2504
const GRIP_TURN: readonly number[] = [
  1,
  0,
  0,
  0,
  GRIP_COSINE,
  -GRIP_SINE,
  0,
  GRIP_SINE,
  GRIP_COSINE,
]

const HEADGEAR =
  /\b(hat|helmet|hair|headdress|headgear|cap|crown|hood|turban|tiara|bandana|headband)\b/i
const NOT_HELD =
  /\b(torso|head|hips|legs?|arms?|hand|neck|cape|visor|plume|hose|armou?r|vest|skirt|backpack|airtanks|epaulettes?|beard|moustache|mask|flippers?)\b/i
const MINIFIG_TITLE = /^[~=_]*minifig\s/i
const WITH_ARMS = /\barms\b/i

const getTransposed = (rotation: readonly number[]): readonly number[] =>
  [0, 3, 6, 1, 4, 7, 2, 5, 8].map((index) => rotation[index] ?? 0)

const getDifference = (first: Vector, second: Vector): Vector => [
  first[0] - second[0],
  first[1] - second[1],
  first[2] - second[2],
]

const createConnection = (
  kind: ConnectionKind,
  isMale: boolean,
  position: Vector,
  rotation: readonly number[] = IDENTITY
): PartConnection =>
  Object.freeze({
    kind,
    isMale,
    position,
    direction: rotateVector(rotation, PART_UP),
    rotation: Object.freeze([...rotation]),
  })

const createStud = (isMale: boolean, position: Vector, direction: Vector): PartConnection =>
  Object.freeze({ kind: ConnectionKind.STUD, isMale, position, direction, rotation: IDENTITY })

// Where a hand sits on the end of an arm: the hand's place in the torso's frame seen from the arm's.
const getWrist = (
  armAt: Vector,
  armTurn: readonly number[],
  handAt: Vector,
  handTurn: readonly number[]
): PartConnection => {
  const back = getTransposed(armTurn)
  return createConnection(
    ConnectionKind.WRIST,
    true,
    rotateVector(back, getDifference(handAt, armAt)),
    multiplyRotations(back, handTurn)
  )
}

const RIGHT_SHOULDER: Vector = [-SHOULDER[0], SHOULDER[1], SHOULDER[2]]
const RIGHT_HAND_AT: Vector = [-LEFT_HAND_AT[0], LEFT_HAND_AT[1], LEFT_HAND_AT[2]]

const TORSO_JOINTS: readonly PartConnection[] = [
  createConnection(ConnectionKind.NECK, true, ORIGIN),
  createConnection(ConnectionKind.HIP, false, [0, TORSO_ON_HIPS, 0]),
]
const SHOULDER_JOINTS: readonly PartConnection[] = [
  createConnection(ConnectionKind.LEFT_ARM, true, SHOULDER, LEFT_ARM_TURN),
  createConnection(ConnectionKind.RIGHT_ARM, true, RIGHT_SHOULDER, RIGHT_ARM_TURN),
]

// The minifigure's parts by number (older numbers too, prints and assemblies included).
export const MINIFIG_CONNECTIONS: readonly MinifigConnectionEntry[] = Object.freeze([
  {
    pattern: /^3626/,
    connections: [
      createConnection(ConnectionKind.NECK, false, [0, HEAD_ON_TORSO, 0]),
      createConnection(ConnectionKind.HAT, true, ORIGIN),
    ],
  },
  { pattern: /^(?:973|76382)/, connections: TORSO_JOINTS },
  {
    pattern: /^(?:3815|970)/,
    connections: [
      createConnection(ConnectionKind.HIP, true, ORIGIN),
      createConnection(ConnectionKind.LEG, true, [0, HIP_AXLE, 0]),
    ],
  },
  {
    pattern: /^(?:3816|3817|971|972|2532)/,
    connections: [createConnection(ConnectionKind.LEG, false, ORIGIN)],
  },
  {
    pattern: /^(?:3819|981)/,
    connections: [
      createConnection(ConnectionKind.LEFT_ARM, false, ORIGIN),
      getWrist(SHOULDER, LEFT_ARM_TURN, LEFT_HAND_AT, LEFT_HAND_TURN),
    ],
  },
  {
    pattern: /^(?:3818|982)/,
    connections: [
      createConnection(ConnectionKind.RIGHT_ARM, false, ORIGIN),
      getWrist(RIGHT_SHOULDER, RIGHT_ARM_TURN, RIGHT_HAND_AT, RIGHT_HAND_TURN),
    ],
  },
  {
    pattern: /^(?:3820|983|2531)/,
    connections: [
      createConnection(ConnectionKind.WRIST, false, ORIGIN),
      createConnection(ConnectionKind.GRIP, true, GRIP_AT, GRIP_TURN),
    ],
  },
])

const getPartNumber = (partName: string): string =>
  (partName.split(/[\\/]/).pop() ?? '').toLowerCase().replace(/\.dat$/, '')

// The joints a minifigure part offers by its number, else by its title: headgear sits on the head's stud, a tool in a hand.
export const getMinifigConnections = (
  partName: string,
  description: string
): readonly PartConnection[] => {
  const number = getPartNumber(partName)
  const entry = MINIFIG_CONNECTIONS.find((candidate) => candidate.pattern.test(number))
  if (entry !== undefined) {
    const isTorsoWithoutArms = entry.connections === TORSO_JOINTS && !WITH_ARMS.test(description)
    return isTorsoWithoutArms ? [...entry.connections, ...SHOULDER_JOINTS] : entry.connections
  }
  if (!MINIFIG_TITLE.test(description)) return []
  if (HEADGEAR.test(description)) return [createConnection(ConnectionKind.HAT, false, ORIGIN)]
  return NOT_HELD.test(description) ? [] : [createConnection(ConnectionKind.GRIP, false, ORIGIN)]
}

const getCellCentres = (minimum: number, maximum: number): readonly number[] => {
  const start = Math.round(minimum / HALF_STUD) * HALF_STUD
  const count = (Math.round(maximum / HALF_STUD) * HALF_STUD - start) / STUD_WIDTH
  return Number.isInteger(count) && count >= 1
    ? Array.from({ length: count }, (_unused, index) => start + HALF_STUD + index * STUD_WIDTH)
    : []
}

// Where the studs below go into a part, in its frame: its sockets (a hat's, above its bottom; a brick's tubes, at its bottom, are
// left to its stud cells), else each stud cell of its footprint (a brick's, a plate's, a tile's bottom), else under each upward stud
// at its bottom.
const getReceptacles = (shape: PartShape): readonly PartConnection[] => {
  const footprint: BuilderBox | null = shape.footprint
  const sockets = shape.holes.filter(
    (hole) => footprint === null || Math.abs(hole.position[1] - footprint.maximum[1]) > SAME_LEVEL
  )
  if (sockets.length > 0)
    return sockets.map((hole) => createStud(false, hole.position, hole.direction))
  const footprintCells =
    footprint === null
      ? []
      : getCellCentres(footprint.minimum[0], footprint.maximum[0]).flatMap((x) =>
          getCellCentres(footprint.minimum[2], footprint.maximum[2]).map((z) =>
            createStud(false, [x, footprint.maximum[1], z], PART_UP)
          )
        )
  if (footprintCells.length > 0) return footprintCells
  const bottom = shape.bottom
  return bottom === null
    ? []
    : shape.studs
        .filter((stud) => stud.direction[1] < -UPWARD)
        .map((stud) => createStud(false, [stud.position[0], bottom, stud.position[2]], PART_UP))
}

// Every connection of a part in its own frame: its studs, its receptacles (a hat's socket among them) and its minifigure joints.
export const getPartConnections = (partName: string, shape: PartShape): readonly PartConnection[] =>
  Object.freeze([
    ...shape.studs.map((stud) => createStud(true, stud.position, stud.direction)),
    ...getReceptacles(shape),
    ...getMinifigConnections(partName, shape.description),
  ])
