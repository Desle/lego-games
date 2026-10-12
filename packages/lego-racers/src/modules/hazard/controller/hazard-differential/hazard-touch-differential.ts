import type {
  EmulatorArgument,
  EmulatorBuffer,
  EmulatorPatch,
} from '../../../../shared/emulator/emulator-client.types.ts'
import { BUS_RECORDER_PATCHES, EFFECT_ADDRESS } from './hazard-differential.ts'

// The touch callbacks (lava 0x0048dcd0, ghost 0x0048ce90, crane 0x00490490) call car body slots through the racer's
// vtable, the figure's position getter and the bus. The vtable here points at recorders that log the slot and its
// arguments; the log is the third buffer, so it sits at 0x20000100 (after the bus log of 64 words).
export const SLOT_LOG_ADDRESS = EFFECT_ADDRESS
export const SLOT_LOG_WORD_COUNT = 32
const SLOT_ENTRY_WORDS = 4
// Unused code of the crane's constructor area: room for the recorders and the getter.
const SPIN_RECORDER_ADDRESS = 0x0048fe30
const FLAG_RECORDER_ADDRESS = 0x0048fe90
const IMPULSE_RECORDER_ADDRESS = 0x0048fef0
const FIGURE_GETTER_ADDRESS = 0x0048ff40
const VOICE_ADDRESS = 0x00439240
const SOUND_ADDRESS = 0x00443b80
const SPIN_TAG = 1
const FLAG_TAG = 2
const IMPULSE_TAG = 3
const SLOT_TAG_NAMES: Readonly<Record<number, string>> = Object.freeze({
  [SPIN_TAG]: 'spin',
  [FLAG_TAG]: 'flag',
  [IMPULSE_TAG]: 'impulse',
})

const getWordBytes = (word: number): readonly number[] => [
  word & 0xff,
  (word >>> 8) & 0xff,
  (word >>> 16) & 0xff,
  (word >>> 24) & 0xff,
]

// mov eax,[log]; shl eax,4; mov dword [eax+log+4],tag; one read and store per argument; inc dword [log]; ret.
const getSlotRecorder = (
  tag: number,
  readers: readonly (readonly number[])[],
  returnBytes: number
): readonly number[] => [
  0xa1,
  ...getWordBytes(SLOT_LOG_ADDRESS),
  0xc1,
  0xe0,
  0x04,
  0xc7,
  0x80,
  ...getWordBytes(SLOT_LOG_ADDRESS + 4),
  ...getWordBytes(tag),
  ...readers.flatMap((reader, index) => [
    ...reader,
    0x89,
    0x88,
    ...getWordBytes(SLOT_LOG_ADDRESS + 8 + index * 4),
  ]),
  0xff,
  0x05,
  ...getWordBytes(SLOT_LOG_ADDRESS),
  0xc2,
  returnBytes,
  0,
]

// mov ecx,[esp+offset]
const getStackArgumentReader = (offset: number): readonly number[] => [0x8b, 0x4c, 0x24, offset]
// mov edx,[esp+4]; mov ecx,[edx+offset]
const getPointedFloatReader = (offset: number): readonly number[] => [
  0x8b,
  0x54,
  0x24,
  0x04,
  0x8b,
  0x4a,
  offset,
]

// The figure's position getter (vtable slot +4, one pointer argument): writes (10, 20, 30), the test racer's position.
const FIGURE_POSITION_GETTER: readonly number[] = [
  0x8b,
  0x44,
  0x24,
  0x04,
  0xc7,
  0x00,
  ...getWordBytes(0x41200000),
  0xc7,
  0x40,
  0x04,
  ...getWordBytes(0x41a00000),
  0xc7,
  0x40,
  0x08,
  ...getWordBytes(0x41f00000),
  0xc2,
  0x04,
  0x00,
]

export const TOUCH_RECORDER_PATCHES: readonly EmulatorPatch[] = Object.freeze([
  ...BUS_RECORDER_PATCHES,
  {
    address: SPIN_RECORDER_ADDRESS,
    bytes: getSlotRecorder(
      SPIN_TAG,
      [getStackArgumentReader(4), getStackArgumentReader(8), getStackArgumentReader(12)],
      12
    ),
  },
  { address: FLAG_RECORDER_ADDRESS, bytes: getSlotRecorder(FLAG_TAG, [], 0) },
  {
    address: IMPULSE_RECORDER_ADDRESS,
    bytes: getSlotRecorder(
      IMPULSE_TAG,
      [getPointedFloatReader(0), getPointedFloatReader(4), getPointedFloatReader(8)],
      8
    ),
  },
  { address: FIGURE_GETTER_ADDRESS, bytes: FIGURE_POSITION_GETTER },
  { address: VOICE_ADDRESS, bytes: [0xc2, 0x04, 0x00] },
  { address: SOUND_ADDRESS, bytes: [0xc2, 0x18, 0x00] },
])

export const SLOT_LOG_BUFFER: EmulatorBuffer = Object.freeze({
  name: 'slotLog',
  words: Object.freeze(Array.from({ length: SLOT_LOG_WORD_COUNT }, (): EmulatorArgument => 0)),
  isRead: true,
})

// The racer's words that the touches read: the car body vtable pointer at +0x3e8 and the figure pointer at +0x5c.
export const RACER_WORD_COUNT = 0xd10 / 4
export const FIGURE_WORD = 0x5c / 4
export const CAR_BODY_WORD = 0x3e8 / 4
export const SPIN_FLAGS_WORD = 0xaa8 / 4
export const FORWARD_SPEED_WORD = 0xa00 / 4
export const RACER_FLAGS_WORD = 0xd04 / 4
export const VELOCITY_WORD = 0x3f0 / 4

// The vtables of the car body (slots 7, 9 and 14 at +0x1c, +0x24 and +0x38) and of the figure (slot 1 at +4).
export const getTouchSupportBuffers = (): readonly EmulatorBuffer[] => {
  const carBodyVtable: EmulatorArgument[] = Array.from({ length: 24 }, () => 0)
  carBodyVtable[7] = IMPULSE_RECORDER_ADDRESS
  carBodyVtable[9] = SPIN_RECORDER_ADDRESS
  carBodyVtable[14] = FLAG_RECORDER_ADDRESS
  return [
    { name: 'carBodyVtable', words: carBodyVtable, isRead: false },
    { name: 'figure', words: [{ buffer: 'figureVtable' }], isRead: false },
    { name: 'figureVtable', words: [0, FIGURE_GETTER_ADDRESS], isRead: false },
  ]
}

// The slot calls as the port's tests name them: `spin 1065353216 1008981770 0`, `flag`, `impulse 0 0 1125515264`.
export const getSlotCalls = (words: readonly number[]): readonly string[] =>
  Array.from({ length: words[0] ?? 0 }, (_, index) => {
    const entry = words.slice(1 + index * SLOT_ENTRY_WORDS, 5 + index * SLOT_ENTRY_WORDS)
    const name = SLOT_TAG_NAMES[entry[0] ?? 0] ?? 'unknown'
    return entry[0] === FLAG_TAG ? name : [name, ...entry.slice(1, 4)].join(' ')
  })
