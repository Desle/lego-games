import { CoverageOrigin, HookKind, RacerPartKind } from './hd-coverage.types.ts'
import type { CensusSighting, HookCall } from './hd-coverage.types.ts'
import type { OnScreenFrame, OnScreenMaterialGroup } from './on-screen-check.types.ts'
import {
  getExpectedPowerUpFailures,
  getOnScreenFailures,
  getPowerUpOnScreenFailures,
} from './on-screen-judgement.ts'

const INVALID_OPERATION = 0x502

const PLASTIC: OnScreenMaterialGroup = {
  material: 'MeshPhysicalMaterial',
  isPictured: false,
  meshCount: 12,
  changedPixels: 4200,
}

const FACE: OnScreenMaterialGroup = {
  material: 'MeshStandardMaterial',
  isPictured: true,
  meshCount: 2,
  changedPixels: 300,
}

const getFrame = (change: Partial<OnScreenFrame>): OnScreenFrame => ({
  label: 'step 60',
  webglErrors: [],
  unchangedDifference: 0,
  drawings: [
    {
      callId: 1,
      hook: HookKind.DRIVER,
      key: 'parts:1 2 3',
      changedPixels: 4500,
      posedPartPixels: [],
      groups: [PLASTIC, FACE],
    },
  ],
  ...change,
})

describe('getOnScreenFailures', () => {
  it('passes a figure whose plastic and pictures reach the screen', () => {
    // Arrange
    const frames = [getFrame({})]

    // Act
    const failures = getOnScreenFailures(frames, [HookKind.DRIVER])

    // Assert
    expect(failures).toEqual([])
  })

  // PR #183: the plastic's shadow sampler had a colour texture, WebGL refused every plastic draw and only the decals showed.
  it('fails a figure whose plastic draws were refused and only its decals show', () => {
    // Arrange
    const frames = [
      getFrame({
        webglErrors: [INVALID_OPERATION],
        drawings: [
          {
            callId: 1,
            hook: HookKind.DRIVER,
            key: 'parts:1 2 3',
            changedPixels: 300,
            posedPartPixels: [],
            groups: [{ ...PLASTIC, changedPixels: 0 }, FACE],
          },
        ],
      }),
    ]

    // Act
    const failures = getOnScreenFailures(frames, [HookKind.DRIVER])

    // Assert
    expect(failures).toEqual([
      'step 60: WebGL errors 0x502',
      'step 60: the MeshPhysicalMaterial meshes (12) of the drawings on screen changed 0 pixels',
    ])
  })

  it('fails a place whose expected racer part reaches no pixel', () => {
    // Arrange
    const frames = [getFrame({ drawings: [] })]

    // Act
    const failures = getOnScreenFailures(frames, [HookKind.CAR, HookKind.DRIVER])

    // Assert
    expect(failures).toEqual([
      'step 60: no car drawing reached the screen',
      'step 60: no driver drawing reached the screen',
    ])
  })

  it('counts a change no larger than the frame noise as nothing', () => {
    // Arrange
    const frames = [getFrame({ unchangedDifference: 5000 })]

    // Act
    const failures = getOnScreenFailures(frames, [HookKind.DRIVER])

    // Assert
    expect(failures).toEqual(['step 60: no driver drawing reached the screen'])
  })

  it("fails a plain material kind that draws nothing in any car, not one car's part hidden behind another", () => {
    // Arrange
    const frames = [
      getFrame({
        drawings: [
          {
            callId: 1,
            hook: HookKind.CAR,
            key: 'RKCM',
            changedPixels: 1500,
            posedPartPixels: [],
            groups: [PLASTIC],
          },
          {
            callId: 2,
            hook: HookKind.CAR,
            key: 'CCCM',
            changedPixels: 1200,
            posedPartPixels: [],
            groups: [
              { ...PLASTIC, changedPixels: 0 },
              { ...FACE, isPictured: false, changedPixels: 0 },
            ],
          },
          {
            callId: 3,
            hook: HookKind.DRIVER,
            key: 'CCPELVIS',
            changedPixels: 0,
            posedPartPixels: [],
            groups: [{ ...PLASTIC, changedPixels: 0 }],
          },
        ],
      }),
    ]

    // Act
    const failures = getOnScreenFailures(frames, [HookKind.CAR])

    // Assert
    expect(failures).toEqual([
      'step 60: the MeshStandardMaterial meshes (2) of the drawings on screen changed 0 pixels',
    ])
  })

  it('lets a picture facing away stay off the screen', () => {
    // Arrange
    const frames = [
      getFrame({
        drawings: [
          {
            callId: 1,
            hook: HookKind.DRIVER,
            key: 'parts:1 2 3',
            changedPixels: 4200,
            posedPartPixels: [],
            groups: [PLASTIC, { ...FACE, changedPixels: 0 }],
          },
        ],
      }),
    ]

    // Act
    const failures = getOnScreenFailures(frames, [HookKind.DRIVER])

    // Assert
    expect(failures).toEqual([])
  })
})

describe('getPowerUpOnScreenFailures', () => {
  it('fails a power-up object drawn from its file that no frame shows, not one without a file', () => {
    // Arrange
    const getCall = (id: number, key: string, isModelPresent: boolean): HookCall => ({
      id,
      hook: HookKind.EFFECT_MODEL,
      key,
      wheelsKey: null,
      isModelPresent,
      isDrawingReturned: isModelPresent,
      isFailed: false,
    })
    const calls = [
      getCall(1, 'DMISSILE', true),
      getCall(2, 'SHEOUT3', true),
      getCall(3, 'BARREL', false),
    ]
    const getDrawing = (callId: number, key: string, changedPixels: number) => ({
      callId,
      hook: HookKind.EFFECT_MODEL,
      key,
      changedPixels,
      posedPartPixels: [],
      groups: [PLASTIC],
    })
    const frames = [
      getFrame({ drawings: [getDrawing(1, 'DMISSILE', 900), getDrawing(2, 'SHEOUT3', 10)] }),
    ]

    // Act
    const failures = getPowerUpOnScreenFailures(frames, calls)

    // Assert
    expect(failures).toEqual([
      'the power-up object SHEOUT3 reached the screen in none of the frames',
    ])
  })

  it("fails the twin turbo's burner when its two posed parts never show in one frame", () => {
    // Arrange: the drawing shows, but its second burner only in a frame where the first is hidden
    const calls: readonly HookCall[] = [
      {
        id: 1,
        hook: HookKind.EFFECT_MODEL,
        key: 'DT2CBURN',
        wheelsKey: null,
        isModelPresent: true,
        isDrawingReturned: true,
        isFailed: false,
      },
    ]
    const getBurner = (posedPartPixels: readonly number[]) => ({
      callId: 1,
      hook: HookKind.EFFECT_MODEL,
      key: 'DT2CBURN',
      changedPixels: 900,
      groups: [PLASTIC],
      posedPartPixels,
    })
    const apart = [
      getFrame({ label: 'step 10', drawings: [getBurner([900, 0])] }),
      getFrame({ label: 'step 25', drawings: [getBurner([0, 900])] }),
    ]
    const together = [getFrame({ drawings: [getBurner([450, 450])] })]

    // Act
    const failures = [apart, together].map((frames) => getPowerUpOnScreenFailures(frames, calls))

    // Assert
    expect(failures).toEqual([
      ["the power-up object DT2CBURN's 2 posed parts never all reached the screen in one frame"],
      [],
    ])
  })
})

describe('getExpectedPowerUpFailures', () => {
  it('fails an expected power-up object that neither the layer nor the original drew', () => {
    // Arrange
    const sightings: readonly CensusSighting[] = [
      {
        origin: CoverageOrigin.ORIGINAL,
        kind: RacerPartKind.POWER_UP,
        key: 'BARREL',
        callId: null,
      },
      { origin: CoverageOrigin.LAYER, kind: RacerPartKind.POWER_UP, key: 'DMISSILE', callId: 4 },
      { origin: CoverageOrigin.ORIGINAL, kind: RacerPartKind.BODY, key: 'GRAPPLE', callId: null },
    ]

    // Act
    const failures = getExpectedPowerUpFailures(sightings, ['BARREL', 'DMISSILE', 'GRAPPLE'])

    // Assert
    expect(failures).toEqual([
      'the power-up object GRAPPLE was drawn in none of the rendered frames',
    ])
  })
})
