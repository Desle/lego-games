import type { TraceScenarioRequest } from './trace-scenarios.types.ts'

// The closed-loop drive of the barrier golden trace fires a cannon ball at the shortcut barrels of RACEC0R1 at frame 1460:
// the original opens the barrier at 1477 (surface-signals.md) and draws the barrels' parts fading while their clip plays.
export const BARRIER_REQUEST: TraceScenarioRequest = {
  name: 'Pirate shortcut barrels',
  raceFolder: 'RACEC0R1',
  isRouteDriven: true,
  recordFrames: [1470, 1478, 1480, 1490, 1550],
  powerUp: { kind: 1, level: 0, grantFrame: 1457, useFrame: 1460, frameCount: 1560 },
  watched: [{ label: 'barrels', originalTexture: '^barrel2$', portSource: '^(block|barrel)' }],
}
