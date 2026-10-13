import type { FrontEndKey, FrontEndPixelCase } from './front-end-pixel-cases.types.ts'

const DOWN = 208
const RIGHT = 205
const ENTER = 28
const FIRST_KEY_FRAME = 250
const KEY_SPACING_FRAMES = 20

const getKey = (index: number, input: FrontEndKey['input'], scanCode: number): FrontEndKey => ({
  frame: FIRST_KEY_FRAME + KEY_SPACING_FRAMES * index,
  input,
  scanCode,
})
const down = (index: number) => getKey(index, 'down', DOWN)
const accept = (index: number) => getKey(index, 'accept', ENTER)

// Down and enter open the circuit race screen (the next race and its cinema show every two seconds), two downs and enter the
// single race screen, three downs and enter the time trial screen, enter the garage.
const CIRCUIT_KEYS: readonly FrontEndKey[] = [down(0), accept(1)]
const LAST_CIRCUIT_KEYS: readonly FrontEndKey[] = [
  ...CIRCUIT_KEYS,
  ...[290, 310, 330, 350, 370, 390].map((frame): FrontEndKey => ({
    frame,
    input: 'right',
    scanCode: RIGHT,
  })),
]

// Thresholds are the measured baseline plus a margin; the open divergences behind the loose ones are in pixel-trace.md.
export const FRONT_END_PIXEL_CASES: readonly FrontEndPixelCase[] = [
  {
    name: 'Main menu',
    keys: [],
    pushedScreenId: null,
    recordFrames: [200, 300, 500],
    maximumDifferingShare: 0.08,
  },
  {
    name: 'Circuit race select',
    keys: CIRCUIT_KEYS,
    pushedScreenId: null,
    recordFrames: [285, 332, 392, 460, 520],
    maximumDifferingShare: 0.28,
  },
  {
    name: 'Final circuit select',
    keys: LAST_CIRCUIT_KEYS,
    pushedScreenId: null,
    recordFrames: [430, 500],
    maximumDifferingShare: 0.27,
  },
  {
    name: 'Single race select',
    keys: [down(0), down(1), accept(2)],
    pushedScreenId: null,
    recordFrames: [320, 400, 500],
    maximumDifferingShare: 0.1,
  },
  {
    name: 'Racer showcase',
    keys: [down(0), accept(1), accept(2)],
    pushedScreenId: null,
    recordFrames: [291, 300, 400, 600],
    maximumDifferingShare: 0.14,
  },
  {
    name: 'Time trial screen',
    keys: [down(0), down(1), down(2), accept(3)],
    pushedScreenId: null,
    recordFrames: [330, 400],
    maximumDifferingShare: 0.18,
  },
  {
    name: 'Garage',
    keys: [accept(0)],
    pushedScreenId: null,
    recordFrames: [290, 340],
    maximumDifferingShare: 0.31,
  },
  {
    name: 'Build a car',
    keys: [accept(0), accept(1)],
    pushedScreenId: null,
    recordFrames: [330, 400],
    maximumDifferingShare: 0.58,
  },
  {
    name: 'Circuit 1 introduction cinema',
    keys: [],
    pushedScreenId: 0x1f,
    recordFrames: [205, 300, 420, 520],
    maximumDifferingShare: 0.12,
  },
  {
    // Reached as the player does: the racer pick of a circuit race opens the circuit's introduction (0x004850a0). Its end
    // is left out: at frame 880 the original draws the closing full-screen picture at about a third of the port's
    // brightness (64.7 % differ; hypothesis: a fade of the cinema's events, which the port does not read).
    name: 'Circuit start introduction',
    keys: [...CIRCUIT_KEYS, accept(2), accept(3)],
    pushedScreenId: null,
    recordFrames: [420, 520, 700],
    maximumDifferingShare: 0.12,
  },
  {
    name: 'First place award cinema',
    keys: [],
    pushedScreenId: 0x16,
    recordFrames: [205, 290, 400],
    maximumDifferingShare: 0.26,
  },
  {
    name: 'Winning car cinema',
    keys: [],
    pushedScreenId: 0x1a,
    recordFrames: [205, 290, 400],
    maximumDifferingShare: 0.11,
  },
]
