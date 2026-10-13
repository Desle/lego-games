import type { PixelTraceCase } from './pixel-trace-cases.types.ts'
import { BARRIER_REQUEST } from './play-test-visual-cases.ts'

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
    maximumDifferingShare: 0.012,
    watchedTextures: [{ label: 'oilslk64', maximumDifferingShare: 0.05 }],
  },
  {
    // The computers use curses from frame 164; the player drives into one at 191 and wears the curse figure from then on.
    // Before the curse was drawn, none of its pictures (`curse1` and the green rings) was on the screen.
    request: {
      name: 'Royal Knights, curse hit',
      raceFolder: 'RACEC0R0',
      recordFrames: [190, 192, 215, 230, 260, 290],
      powerUp: {
        kind: 4,
        level: 3,
        grantFrame: 162,
        useFrame: 1000,
        frameCount: 320,
        grantedRacers: [1, 2, 3, 4, 5],
      },
    },
    // The worst frames (190, 192) are the tire smoke (`csmoke`) of the cars at the start, not the curse.
    maximumDifferingShare: 0.08,
    // The curse's picture (`curse1`), which the matcher names by its hash.
    watchedTextures: [{ label: 'ee51a0cde6ae2c1d', maximumDifferingShare: 0.06 }],
  },
  {
    // A later race of a circuit (the totals so far are in the record): three racers are done with their laps at frames
    // 300 and 330 (the player second), so the race's table shows from frame 452 (5 s into the finishing state) and the
    // circuit's totals from 604 (the results state). The player's row blinks with the record's countdown.
    request: {
      name: 'Royal Knights, circuit points table',
      raceFolder: 'RACEC0R0',
      frameCount: 760,
      racerFinishes: [
        { frame: 300, racer: 3, lapMilliseconds: [30_120, 31_480, 29_900] },
        { frame: 300, racer: 0, lapMilliseconds: [31_000, 30_520, 32_440] },
        { frame: 330, racer: 5, lapMilliseconds: [29_000, 28_250, 27_010] },
      ],
      pointsRecordTotals: [40, 25, 33, 10, 5, 7],
      recordFrames: [448, 455, 460, 470, 600, 610, 615, 700],
    },
    // Worst 3.08 % (frame 470). The table's text (`font_ths`, named by its hash) differs in 16 to 19 % of its pixels,
    // as the HUD's own text does before the table shows (frame 448: 18.8 %).
    maximumDifferingShare: 0.035,
    watchedTextures: [{ label: 'eea37d3f06eea066', maximumDifferingShare: 0.21 }],
  },
  {
    request: {
      name: 'Royal Knights',
      raceFolder: 'RACEC0R0',
      recordFrames: [100, 170, 250, 320],
    },
    maximumDifferingShare: 0.045,
    watchedTextures: [],
  },
  {
    // The camera lock of 0x004047b0: before it was ported the scene was displaced (51.5 percent differed). The rest is
    // edges and the textures the matcher cannot name (pixel-trace.md).
    request: {
      name: 'Royal Knights, introduction',
      raceFolder: 'RACEC0R0',
      recordFrames: [5],
    },
    maximumDifferingShare: 0.003,
    watchedTextures: [],
  },
  {
    request: {
      name: 'Royal Knights, power slide',
      raceFolder: 'RACEC0R0',
      isPowerSliding: true,
      recordFrames: [240, 260, 275, 285, 300, 340, 400],
    },
    // The dust and smoke quads keep their texture's row order (flag 4 clear): before, frame 300 differed 4.15 percent.
    maximumDifferingShare: 0.025,
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
    maximumDifferingShare: 0.04,
    watchedTextures: [
      { label: 'titwat2', maximumDifferingShare: 0.02 },
      // The warp portal's picture (`warphole`), which the matcher names by its hash.
      { label: '69645e3c29b12070', maximumDifferingShare: 0.05 },
    ],
  },
  {
    // The demonstration lap passes the track's tree sprites (world keyword 0x37, GolDP.dll 0x10009a70): before they were
    // drawn their picture (`rktree`, named `rndtree` by the matcher) was missing from both frames.
    request: {
      name: 'Royal Knights, world sprites',
      raceFolder: 'RACEC0R0',
      localPlayerCount: 0,
      frameCount: 345,
      recordFrames: [250, 340],
    },
    maximumDifferingShare: 0.03,
    watchedTextures: [{ label: 'rndtree', maximumDifferingShare: 0.04 }],
  },
  {
    request: {
      name: 'Royal Knights, barrel scars',
      raceFolder: 'RACEC0R0',
      powerUp: { kind: 4, level: 1, grantFrame: 300, useFrame: 305, frameCount: 460 },
      recordFrames: [390, 400, 420, 440],
    },
    maximumDifferingShare: 0.01,
    watchedTextures: [],
  },
  {
    // The grapple's hook flies at 305, latches or misses and the rope retracts: frames 307 to 320 show the tether strip.
    request: {
      name: 'Royal Knights, grapple',
      raceFolder: 'RACEC0R0',
      powerUp: { kind: 1, level: 1, grantFrame: 300, useFrame: 305, frameCount: 340 },
      recordFrames: [307, 312, 316, 320, 330],
    },
    maximumDifferingShare: 0.015,
    watchedTextures: [{ label: 'rope', maximumDifferingShare: 0.1 }],
  },
  {
    // The wand's beam grows from the muzzle at 305 and holds for 7 seconds: the lightning strip faces the camera.
    request: {
      name: 'Royal Knights, wand',
      raceFolder: 'RACEC0R0',
      powerUp: { kind: 1, level: 2, grantFrame: 300, useFrame: 305, frameCount: 340 },
      recordFrames: [307, 312, 320, 326, 335],
    },
    maximumDifferingShare: 0.015,
    watchedTextures: [{ label: 'lightng', maximumDifferingShare: 0.08 }],
  },
  {
    request: {
      name: 'RACEC0R1, crane shadow',
      raceFolder: 'RACEC0R1',
      isSteering: true,
      recordFrames: [392, 400, 410, 420],
    },
    maximumDifferingShare: 0.02,
    watchedTextures: [],
  },
  {
    // A cannon ball breaks the pirate shortcut's barrels at frame 1477: the gate draws the pieces flying apart and fading
    // with their clip (LEGORacers.exe 0x0048f080) while the camera still sees them. They are about 700 units away and
    // cover few pixels, so this case only guards the frame; the render trace's barrier case counts their triangles.
    request: { ...BARRIER_REQUEST, name: 'RACEC0R1, breaking barrels', recordFrames: [1478, 1480] },
    // 0.64 percent measured (smoke, skid marks and the HUD's known differences).
    maximumDifferingShare: 0.01,
    watchedTextures: [],
  },
  {
    // The final race's wall lights are the material flipbook of TEST.MAB: the animation rewrites two slots of the
    // track model's material table (LEGORacers.exe 0x004104c0, 0x00410750) and the lights cycle through rrlite1 to rrlite8.
    request: {
      name: 'RACEC3R0, wall lights',
      raceFolder: 'RACEC3R0',
      recordFrames: [100, 170, 200, 230, 260],
    },
    // Before the flipbook the lights stayed on rrlite4 and rrlite8 and 9.2 percent of the pixels the original paints with
    // rrlite1 to rrlite3 differed (1.4 percent now). The worst frame is the skid marks (pixel-trace.md).
    maximumDifferingShare: 0.055,
    watchedTextures: [
      { label: 'rrlite1', maximumDifferingShare: 0.03 },
      { label: 'rrlite2', maximumDifferingShare: 0.03 },
      { label: 'rrlite3', maximumDifferingShare: 0.03 },
      { label: 'rrlite4', maximumDifferingShare: 0.03 },
    ],
  },
  {
    // The champion ghost drives from the start line (GHOST.GHB, drawn from GHOST.WDB); the player idles behind it.
    request: {
      name: 'RACEC0R0, time trial ghost',
      raceFolder: 'RACEC0R0',
      isTimeTrial: true,
      recordFrames: [140, 158, 168, 200, 260],
    },
    // The HUD of a time trial (the timers at the top right, an item at the top left) and the countdown lights at frames 140
    // to 168 are the open differences (pixel-trace.md, finding 10); the ghost's pictures are watched on their own.
    maximumDifferingShare: 0.045,
    watchedTextures: [
      // The ghost car's own pictures (GHOST.WDB), which the matcher names by their hashes.
      { label: '2d13aec07aff6e6c', maximumDifferingShare: 0.03 },
      { label: '867676f1b4ecf538', maximumDifferingShare: 0.03 },
    ],
  },
  {
    // The last race's sky dome and planet (render-coverage.md items 1 and 7). The remaining differences are the countdown
    // digits' colour, the skid marks and the planet's texture scroll, which the port does not run yet.
    request: {
      name: 'RACEC3R0, sky and planet',
      raceFolder: 'RACEC3R0',
      recordFrames: [100, 170, 250],
    },
    maximumDifferingShare: 0.06,
    watchedTextures: [],
  },
]
