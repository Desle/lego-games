import { HookKind } from './hd-coverage.types.ts'
import type { OnScreenFrame, OnScreenMaterialGroup } from './on-screen-check.types.ts'
import { getOnScreenFailures } from './on-screen-judgement.ts'

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
          { callId: 1, hook: HookKind.CAR, key: 'RKCM', changedPixels: 1500, groups: [PLASTIC] },
          {
            callId: 2,
            hook: HookKind.CAR,
            key: 'CCCM',
            changedPixels: 1200,
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
