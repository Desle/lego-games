import type { RecordedActivation } from './hazard-differential.types.ts'
import type {
  EmulatorArgument,
  EmulatorBuffer,
  EmulatorPatch,
} from '../../../../shared/emulator/emulator-client.types.ts'

// The log buffer is the first buffer of every call, so the scratch heap puts it at 0x20000000: word 0 counts the
// entries, each entry of three words follows from word 1 (first identifier, tag, second identifier).
export const LOG_ADDRESS = 0x20000000
export const LOG_WORD_COUNT = 64
const ENTRY_WORDS = 3

// The signal bus entry points of the events (race +0x2098): StartSignal 0x00461ef0 and StopSignal 0x00462140 take
// two stack arguments, StartStopSignal 0x00462580 three.
const START_SIGNAL_ADDRESS = 0x00461ef0
const START_STOP_SIGNAL_ADDRESS = 0x00462580
const STOP_SIGNAL_ADDRESS = 0x00462140
const START_TAG = 1
const START_STOP_TAG = 2
const STOP_TAG = 3

const getWordBytes = (word: number): readonly number[] => [
  word & 0xff,
  (word >>> 8) & 0xff,
  (word >>> 16) & 0xff,
  (word >>> 24) & 0xff,
]

// mov eax,[log]; lea edx,[eax+eax*2]; mov ecx,[esp+4]; mov [edx*4+log+4],ecx; mov dword [edx*4+log+8],tag; the
// second identifier (the second stack argument or 0); inc eax; mov [log],eax; ret argumentBytes.
const getRecorder = (tag: number, argumentCount: number): readonly number[] => [
  0xa1,
  ...getWordBytes(LOG_ADDRESS),
  0x8d,
  0x14,
  0x40,
  0x8b,
  0x4c,
  0x24,
  0x04,
  0x89,
  0x0c,
  0x95,
  ...getWordBytes(LOG_ADDRESS + 4),
  0xc7,
  0x04,
  0x95,
  ...getWordBytes(LOG_ADDRESS + 8),
  ...getWordBytes(tag),
  ...(argumentCount === 3
    ? [0x8b, 0x4c, 0x24, 0x08, 0x89, 0x0c, 0x95, ...getWordBytes(LOG_ADDRESS + 12)]
    : [0xc7, 0x04, 0x95, ...getWordBytes(LOG_ADDRESS + 12), ...getWordBytes(0)]),
  0x40,
  0xa3,
  ...getWordBytes(LOG_ADDRESS),
  0xc2,
  argumentCount * 4,
  0,
]

// Code patches that make the three bus functions log their identifiers instead of walking the events.
export const BUS_RECORDER_PATCHES: readonly EmulatorPatch[] = Object.freeze([
  { address: START_SIGNAL_ADDRESS, bytes: getRecorder(START_TAG, 2) },
  { address: START_STOP_SIGNAL_ADDRESS, bytes: getRecorder(START_STOP_TAG, 3) },
  { address: STOP_SIGNAL_ADDRESS, bytes: getRecorder(STOP_TAG, 2) },
])

export const LOG_BUFFER: EmulatorBuffer = Object.freeze({
  name: 'log',
  words: Object.freeze(Array.from({ length: LOG_WORD_COUNT }, (): EmulatorArgument => 0)),
  isRead: true,
})

const TAG_NAMES: Readonly<Record<number, string>> = Object.freeze({
  [START_TAG]: 'start',
  [START_STOP_TAG]: 'startStop',
  [STOP_TAG]: 'stop',
})

// The log as the port's test session writes it: `start 3`, `startStop 3 4`, `stop 3`.
export const getLogCalls = (words: readonly number[]): readonly string[] =>
  Array.from({ length: words[0] ?? 0 }, (_, index) => {
    const first = words[1 + index * ENTRY_WORDS] ?? 0
    const tag = words[2 + index * ENTRY_WORDS] ?? 0
    const second = words[3 + index * ENTRY_WORDS] ?? 0
    const name = TAG_NAMES[tag] ?? 'unknown'
    return tag === START_STOP_TAG
      ? `${name} ${String(first | 0)} ${String(second | 0)}`
      : `${name} ${String(first | 0)}`
  })

// The power-up system's activations (thiscall on the system, two stack arguments: the racer and the kind) read the
// launcher at system +0x1998. The recorder copies the two arguments, the launcher's six floats and a marker into
// the second buffer, which sits at 0x20000100 because the log before it is 64 words.
export const EFFECT_ADDRESS = LOG_ADDRESS + LOG_WORD_COUNT * 4
export const EFFECT_WORD_COUNT = 16
const WARP_ACTIVATION_ADDRESS = 0x0045b260
const HAZARD_ACTIVATION_ADDRESS = 0x0045a9b0
const PROJECTILE_ACTIVATION_ADDRESS = 0x0045a950
const LAUNCHER_OFFSET = 0x1998

const getStoreWord = (value: number, target: number): readonly number[] => [
  0x89,
  0x15,
  ...getWordBytes(target + value * 0),
]

const getActivationRecorder = (): readonly number[] => [
  // mov eax,[ecx+0x1998]
  0x8b,
  0x81,
  ...getWordBytes(LAUNCHER_OFFSET),
  ...Array.from({ length: 6 }, (_, index) => [
    // mov edx,[eax+index*4]; mov [effect+8+index*4],edx
    0x8b,
    0x50,
    index * 4,
    ...getStoreWord(0, EFFECT_ADDRESS + 8 + index * 4),
  ]).flat(),
  // mov edx,[esp+4]; mov [effect],edx; mov edx,[esp+8]; mov [effect+4],edx
  0x8b,
  0x54,
  0x24,
  0x04,
  ...getStoreWord(0, EFFECT_ADDRESS),
  0x8b,
  0x54,
  0x24,
  0x08,
  ...getStoreWord(0, EFFECT_ADDRESS + 4),
  // mov dword [effect+0x20],1; ret 8
  0xc7,
  0x05,
  ...getWordBytes(EFFECT_ADDRESS + 0x20),
  ...getWordBytes(1),
  0xc2,
  8,
  0,
]

export const ACTIVATION_RECORDER_PATCHES: readonly EmulatorPatch[] = Object.freeze([
  { address: WARP_ACTIVATION_ADDRESS, bytes: getActivationRecorder() },
  { address: HAZARD_ACTIVATION_ADDRESS, bytes: getActivationRecorder() },
  { address: PROJECTILE_ACTIVATION_ADDRESS, bytes: getActivationRecorder() },
])

export const EFFECT_BUFFER: EmulatorBuffer = Object.freeze({
  name: 'effect',
  words: Object.freeze(Array.from({ length: EFFECT_WORD_COUNT }, (): EmulatorArgument => 0)),
  isRead: true,
})

// The recorded activation, or null when none was made.
export const getRecordedActivation = (words: readonly number[]): RecordedActivation | null =>
  (words[8] ?? 0) === 0
    ? null
    : {
        racerPointer: words[0] ?? 0,
        kind: words[1] ?? 0,
        launcher: words.slice(2, 8),
      }
