import type { DriverPreview } from '@lego-games/lego-racers/front-end'
import type { JamArchive } from '@lego-games/lego-racers/jam-archive'
import { loadMenuDriverScene } from '@lego-games/lego-racers/racer-appearance'
import { Matrix4 } from 'three'
import type { Scene as ThreeScene } from 'three'
import { createModelObject } from '../model-object/model-object.ts'
import type { ModelObject } from '../model-object/model-object.types.ts'
import { createModelSlot } from '../model-slot/model-slot.ts'
import { showDriverDrawing } from '../racer-drawing/racer-drawing.ts'
import type { DriverView } from './driver-view.types.ts'

// The figure of a menu (`FUN_0047df90`): the figure builder's menu-mode model of the five part bytes on the body's skeleton
// with the menu animations, standing where the screen puts it and turned about the vertical axis to face where its frame's
// forward vector points (the model's front is +x).
export const createDriverView = (archive: JamArchive, scene: ThreeScene): DriverView => {
  const slot = createModelSlot(scene)
  let shown: ModelObject | null = null
  let isFollowingScreen = false
  return Object.freeze({
    show: (preview: DriverPreview) => {
      shown = slot.show(`${preview.animationName}/${preview.partBytes.join(':')}`, () => {
        const scene = loadMenuDriverScene(archive, preview.partBytes, preview.animationName)
        return showDriverDrawing(createModelObject(scene), {
          archive,
          driver: { model: scene, modelName: null, partBytes: preview.partBytes },
        })
      })
      const [x, y, z] = preview.position
      shown.group.matrix
        .copy(new Matrix4().makeRotationZ(Math.atan2(preview.forward[1], preview.forward[0])))
        .setPosition(x, y, z)
      shown.group.matrixWorldNeedsUpdate = true
      if (preview.animation !== null) {
        shown.object.setAnimationState(preview.animation)
        isFollowingScreen = true
      } else {
        isFollowingScreen = false
      }
    },
    animate: (deltaMilliseconds: number) => {
      if (!isFollowingScreen) shown?.object.animate(deltaMilliseconds)
    },
    dispose: slot.dispose,
  })
}
