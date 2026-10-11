import type { DriverPreview } from '@lego-games/lego-racers/front-end'
import type { JamArchive } from '@lego-games/lego-racers/jam-archive'
import { loadMenuDriverScene } from '@lego-games/lego-racers/racer-appearance'
import { Matrix4 } from 'three'
import type { Scene as ThreeScene } from 'three'
import { createModelObject } from '../model-object/model-object.ts'
import type { ModelObject } from '../model-object/model-object.types.ts'
import { createModelSlot } from '../model-slot/model-slot.ts'
import type { DriverView } from './driver-view.types.ts'

// The figure of a menu (`FUN_0047df90`): the figure builder's menu-mode model of the five part bytes on the body's skeleton
// with the menu animations, standing where the screen puts it and turned about the vertical axis to face where its frame's
// forward vector points (the model's front is +x).
export const createDriverView = (archive: JamArchive, scene: ThreeScene): DriverView => {
  const slot = createModelSlot(scene)
  let shown: ModelObject | null = null
  return Object.freeze({
    show: (preview: DriverPreview) => {
      shown = slot.show(preview.partBytes.join(':'), () =>
        createModelObject(loadMenuDriverScene(archive, preview.partBytes))
      )
      const [x, y, z] = preview.position
      shown.group.matrix
        .copy(new Matrix4().makeRotationZ(Math.atan2(preview.forward[1], preview.forward[0])))
        .setPosition(x, y, z)
      shown.group.matrixWorldNeedsUpdate = true
    },
    animate: (deltaMilliseconds: number) => shown?.object.animate(deltaMilliseconds),
    dispose: slot.dispose,
  })
}
