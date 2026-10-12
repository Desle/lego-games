import type { PixelTraceCase } from './pixel-trace-cases.types.ts'

// The render trace's scenarios (render-trace.trace.spec.ts), with the pixels the viewer puts on the screen compared.
// Thresholds are the measured baseline plus a margin: lower them when a case improves. See pixel-trace.md for the open
// divergences behind the looser ones.
export const PIXEL_TRACE_CASES: readonly PixelTraceCase[] = [
  {
    // The slick is dropped at frame 305 right behind the car and is in the chase camera's view for the next frames.
    request: {
      name: 'Royal Knights, oil slick',
      raceFolder: 'RACEC0R0',
      powerUp: { kind: 4, level: 0, grantFrame: 300, useFrame: 305, frameCount: 340 },
      recordFrames: [306, 309, 312, 316, 330],
    },
    maximumDifferingShare: 0.01,
    watchedTextures: [{ label: 'oilslk64', maximumDifferingShare: 0.02 }],
  },
  {
    request: {
      name: 'Royal Knights',
      raceFolder: 'RACEC0R0',
      recordFrames: [100, 170, 250, 320],
    },
    maximumDifferingShare: 0.025,
    watchedTextures: [],
  },
  {
    // The camera lock of 0x004047b0: before it was ported the scene was displaced (51.5 percent differed). The race start's
    // black fade (0x00433525, alpha 154 here) is part of the frame; the rest is edges (pixel-trace.md).
    request: {
      name: 'Royal Knights, introduction',
      raceFolder: 'RACEC0R0',
      recordFrames: [5],
    },
    maximumDifferingShare: 0.005,
    watchedTextures: [],
  },
  {
    request: {
      name: 'Royal Knights, power slide',
      raceFolder: 'RACEC0R0',
      isPowerSliding: true,
      recordFrames: [240, 260, 275, 285, 300, 340, 400],
    },
    maximumDifferingShare: 0.045,
    watchedTextures: [],
  },
  {
    // Frame 310 is the portal, 320 the fade to blue, 330 to 360 the tunnel, 375 the landing. Before the screen fade,
    // the warp's field of view and the blend's alpha were ported the worst frame (320) differed 99.6 percent. The rest of
    // the worst frame (375) is the skid marks, the fence and the water seen after landing (see pixel-trace.md).
    request: {
      name: 'Royal Knights, warp',
      raceFolder: 'RACEC0R0',
      recordFrames: [310, 320, 330, 345, 360, 375],
      powerUp: { kind: 3, level: 3, grantFrame: 300, useFrame: 305, frameCount: 380 },
    },
    maximumDifferingShare: 0.035,
    watchedTextures: [
      { label: 'titwat2', maximumDifferingShare: 0.005 },
      // The warp portal's picture (`warphole`), which the matcher names by its hash.
      { label: '69645e3c29b12070', maximumDifferingShare: 0.02 },
    ],
  },
  {
    request: {
      name: 'Royal Knights, barrel scars',
      raceFolder: 'RACEC0R0',
      powerUp: { kind: 4, level: 1, grantFrame: 300, useFrame: 305, frameCount: 460 },
      recordFrames: [390, 400, 420, 440],
    },
    maximumDifferingShare: 0.006,
    watchedTextures: [],
  },
  {
    request: {
      name: 'RACEC0R1, crane shadow',
      raceFolder: 'RACEC0R1',
      isSteering: true,
      recordFrames: [392, 400, 410, 420],
    },
    maximumDifferingShare: 0.015,
    watchedTextures: [],
  },
]
