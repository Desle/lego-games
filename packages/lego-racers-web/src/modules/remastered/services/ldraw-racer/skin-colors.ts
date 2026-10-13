import { Mesh, MeshPhysicalMaterial } from 'three'
import type { Object3D } from 'three'
import { getIsLookEncoded } from '@lego-games/ldraw/material'

// The viewer draws with no colour management, so the plastic's colours (taken as sRGB, lit in linear light) reach the screen without
// the encoding back: a yellow face comes out orange and dark under any light. A flesh part gets its colours back as the library
// names them, which is how the original's own faces are drawn; the rest of the plastic keeps the look the cars were tuned with.
// The stylised looks encode their own output, so their flesh parts are left as they are.
// The share of a flesh colour that shows with no lamp on it: a face in a hat's shadow stays readable, as the original's pictures were.
const SKIN_ROOM_LIGHT = 0.3

export const restoreDisplayColors = (model: Object3D) => {
  if (getIsLookEncoded()) return
  model.traverse((child) => {
    if (!(child instanceof Mesh)) return
    const materials: unknown[] = Array.isArray(child.material) ? child.material : [child.material]
    for (const material of materials) {
      if (!(material instanceof MeshPhysicalMaterial)) continue
      material.color.convertLinearToSRGB()
      material.emissive.copy(material.color).multiplyScalar(SKIN_ROOM_LIGHT)
    }
  })
}
