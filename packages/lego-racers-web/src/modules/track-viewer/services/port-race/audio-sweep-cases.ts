import type { AudioTraceCase } from './trace-scenarios.types.ts'

const RACE_FOLDERS = [
  'RACEC0R0',
  'RACEC0R1',
  'RACEC0R2',
  'RACEC0R3',
  'RACEC1R0',
  'RACEC1R1',
  'RACEC1R2',
  'RACEC1R3',
  'RACEC2R0',
  'RACEC2R1',
  'RACEC2R2',
  'RACEC2R3',
  'RACEC3R0',
] as const

// Past the countdown (racers are released at frame 160): about a minute of racing by the computers alone.
const COMPUTER_ONLY_FRAME_COUNT = 1500

const COMPUTER_ONLY_CASES: readonly AudioTraceCase[] = RACE_FOLDERS.flatMap((raceFolder) => [
  {
    name: `${raceFolder}, computers only`,
    raceFolder,
    localPlayerCount: 0,
    frameCount: COMPUTER_ONLY_FRAME_COUNT,
  },
  {
    name: `${raceFolder}, computers only, mirrored`,
    raceFolder,
    isMirrored: true,
    localPlayerCount: 0,
    frameCount: COMPUTER_ONLY_FRAME_COUNT,
  },
])

const POWER_UP_KIND_NAMES = ['projectile', 'shield', 'turbo', 'hazard'] as const
const POWER_UP_LEVELS = [0, 1, 2, 3] as const

// The player is handed a brick at frame 300 and uses it at 305; the computers are handed theirs at 162 and use them by
// themselves: every kind at every level, with the hits and endings that follow.
const POWER_UP_CASES: readonly AudioTraceCase[] = POWER_UP_KIND_NAMES.flatMap((kindName, kindIndex) =>
  POWER_UP_LEVELS.flatMap((level): readonly AudioTraceCase[] => [
    {
      name: `Royal Knights, player ${kindName} ${String(level)}`,
      raceFolder: 'RACEC0R0',
      powerUp: { kind: kindIndex + 1, level, grantFrame: 300, useFrame: 305, frameCount: 700 },
    },
    {
      name: `Royal Knights, computers ${kindName} ${String(level)}`,
      raceFolder: 'RACEC0R0',
      powerUp: {
        kind: kindIndex + 1,
        level,
        grantFrame: 162,
        useFrame: 1000,
        frameCount: 700,
        grantedRacers: [1, 2, 3, 4, 5],
      },
    },
  ])
)

export const AUDIO_SWEEP_CASES: readonly AudioTraceCase[] = [
  ...COMPUTER_ONLY_CASES,
  ...POWER_UP_CASES,
]
