import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { openJamArchive } from '@lego-games/lego-racers/jam-archive'
import { PerspectiveCamera, Vector3 } from 'three'
import type { Box3 } from 'three'
import { POWER_UP_OBJECT_MODEL_NAMES } from '../../../../shared/viewer-extensions/effect-model-names.ts'
import {
  BUILDER_FIELD_OF_VIEW,
  BUILDER_VIEW_DIRECTION,
  getBuilderViewPosition,
  getFramingView,
} from './builder-camera.ts'
import { loadEffectModel } from '../../../track-viewer/index.ts'
import {
  getOriginalFrameBounds,
  POWER_UP_STUD_UNITS,
} from '../ldraw-powerup/powerup-object-frame.ts'
import { createOriginalReference } from './builder-reference.ts'
import { getPowerUpGridStuds } from './builder-reference-shape.ts'
import { ReferenceShape } from './builder-reference.types.ts'
import { BuilderItemKind } from './ldraw-builder.types.ts'

const JAM_PATH = resolve(
  import.meta.dirname,
  '../../../../../../../original-files/Lego_Racers_Win_Files_EN/Game Files/LEGO.JAM'
)
const isPresent = existsSync(JAM_PATH)

// The build view beside the original: half of a 1060 x 680 canvas.
const SIDE_BY_SIDE_ASPECT = 530 / 680
const GHOST_ASPECT = 1060 / 680

const getCorners = (box: Box3): readonly Vector3[] =>
  [0, 1, 2, 3, 4, 5, 6, 7].map(
    (corner) =>
      new Vector3(
        corner & 1 ? box.max.x : box.min.x,
        corner & 2 ? box.max.y : box.min.y,
        corner & 4 ? box.max.z : box.min.z
      )
  )

// The largest distance of the box's corners from the screen's centre, in normalised device coordinates (1 is the edge).
const getFramedReach = (box: Box3, aspect: number): number => {
  const view = getFramingView(
    box.min.toArray(),
    box.max.toArray(),
    BUILDER_VIEW_DIRECTION,
    aspect,
    BUILDER_FIELD_OF_VIEW
  )
  const camera = new PerspectiveCamera(BUILDER_FIELD_OF_VIEW, aspect, 0.01, 10_000)
  camera.up.set(0, 0, 1)
  camera.position.set(...getBuilderViewPosition(view))
  camera.lookAt(...view.target)
  camera.updateMatrixWorld(true)
  return Math.max(
    ...getCorners(box).flatMap((corner) => {
      const projected = corner.project(camera)
      return [Math.abs(projected.x), Math.abs(projected.y)]
    })
  )
}

describe.skipIf(!isPresent)("the builder's power-up references", () => {
  const archive = isPresent ? openJamArchive(new Uint8Array(readFileSync(JAM_PATH))) : null

  it.each(POWER_UP_OBJECT_MODEL_NAMES)(
    '%s shows its original framed in the viewport, or says it has none',
    (name) => {
      // Arrange
      if (archive === null) throw new Error('no LEGO.JAM')
      const item = { id: `powerups/${name}`, kind: BuilderItemKind.POWER_UP, name, chassisName: '' }

      // Act
      const reference = createOriginalReference(archive, item)

      // Assert
      if (reference === null || reference.shape === ReferenceShape.NONE) {
        expect(reference?.shape ?? ReferenceShape.NONE).toBe(ReferenceShape.NONE)
        return
      }
      const size = reference.bounds.getSize(new Vector3())
      expect(Math.max(size.x, size.y, size.z)).toBeGreaterThan(0)
      expect(Math.max(size.x, size.y, size.z)).toBeLessThan(getPowerUpGridStuds(reference.bounds))
      expect(getFramedReach(reference.bounds, SIDE_BY_SIDE_ASPECT)).toBeLessThan(1)
      expect(getFramedReach(reference.bounds, GHOST_ASPECT)).toBeLessThan(1)
      expect(getFramedReach(reference.bounds, SIDE_BY_SIDE_ASPECT)).toBeGreaterThan(0.3)
      reference.dispose()
    }
  )

  it("frames a turbo's flame by the room it takes while it plays, in the builder as in the race", () => {
    // Arrange: DT0FLA1 has no triangle on its first vertex's bone; stored, it is 0.24 deep, playing it stretches to about 3.8
    if (archive === null) throw new Error('no LEGO.JAM')
    const model = loadEffectModel(archive, 'DT0FLA1', true)

    // Act
    const raceFrame = getOriginalFrameBounds(model).getSize(new Vector3())
    const shown = createOriginalReference(archive, {
      id: 'powerups/DT0FLA1',
      kind: BuilderItemKind.POWER_UP,
      name: 'DT0FLA1',
      chassisName: '',
    })
    const shownSize = shown?.bounds.getSize(new Vector3()).multiplyScalar(POWER_UP_STUD_UNITS)

    // Assert: the builder shows the same room, in studs of the power-up brick
    expect([raceFrame.z > 3, Math.abs((shownSize?.z ?? 0) - raceFrame.z) < 0.01]).toEqual([
      true,
      true,
    ])
    shown?.dispose()
  })
})
