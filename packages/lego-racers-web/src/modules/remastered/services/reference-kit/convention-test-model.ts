// A small model that proves the axis conventions of the models folder (see its README): each marker stands where its meaning says in the
// car's frame. The frame is the game's, x forward, y to the left, z up, in studs; the file is LDraw's, so (x, y, z) in studs is
// (20 x, -20 z, 20 y) in LDraw units. A brick's part origin is the middle of its top face.
import type { ConventionMarker } from './convention-test-model.types.ts'

const BRICK_HEIGHT_STUDS = 1.2

export const CONVENTION_MARKERS: readonly ConventionMarker[] = Object.freeze([
  {
    name: 'origin: red 1 x 1 brick on the cell at the origin',
    colorCode: 4,
    part: '3005',
    expected: [0.5, 0.5, BRICK_HEIGHT_STUDS],
  },
  {
    name: 'front: white 2 x 2 brick 8 to 10 studs ahead',
    colorCode: 15,
    part: '3003',
    expected: [9, 1, BRICK_HEIGHT_STUDS],
  },
  {
    name: 'left: blue 1 x 1 brick 2 studs to the left',
    colorCode: 1,
    part: '3005',
    expected: [0.5, 2.5, BRICK_HEIGHT_STUDS],
  },
  {
    name: 'up: tower of three yellow bricks',
    colorCode: 14,
    part: '3005',
    expected: [5.5, 0.5, BRICK_HEIGHT_STUDS],
  },
  {
    name: 'up: tower, second brick',
    colorCode: 14,
    part: '3005',
    expected: [5.5, 0.5, 2 * BRICK_HEIGHT_STUDS],
  },
  {
    name: 'up: tower, third brick',
    colorCode: 14,
    part: '3005',
    expected: [5.5, 0.5, 3 * BRICK_HEIGHT_STUDS],
  },
])

const LDRAW_UNITS_PER_STUD = 20
const IDENTITY_ROTATION = '1 0 0 0 1 0 0 0 1'

export const getConventionTestText = (): string =>
  [
    '0 Convention test (lego-games)',
    '0 Name: _convention-test.ldr',
    '0 Author: lego-games',
    '0 The car frame of the models folder: x forward (LDraw x, to the right), y to the left (LDraw z, toward the viewer),',
    '0 z up (LDraw -y). Load it in an LDraw viewer: the white block is the front, the blue one the left side.',
    ...CONVENTION_MARKERS.flatMap(({ name, colorCode, part, expected }) => [
      `0 ${name}`,
      `1 ${String(colorCode)} ${[expected[0], -expected[2], expected[1]]
        .map((value) => String(value * LDRAW_UNITS_PER_STUD))
        .join(' ')} ${IDENTITY_ROTATION} ${part}.dat`,
    ]),
  ].join('\n')
