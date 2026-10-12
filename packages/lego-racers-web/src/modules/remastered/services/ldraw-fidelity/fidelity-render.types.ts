import type { BufferGeometry, Material, Mesh, Scene } from 'three'
import type { FidelityView } from './ldraw-fidelity.types.ts'

// The original and its replacement, each alone in a scene, in the same frame (studs, x forward, y left, z up).
export type FidelityPair = {
  readonly original: Scene
  readonly replacement: Scene
}

// One view of a pair: the silhouettes and the flat colours of both, read back (RGBA rows from the bottom), and how the picture lies in
// the world: studs per pixel and the world directions of its x and y.
export type ViewPictures = {
  readonly view: FidelityView
  readonly size: number
  readonly pixelSize: number
  readonly right: readonly [number, number, number]
  readonly up: readonly [number, number, number]
  readonly originalSilhouette: Uint8Array
  readonly replacementSilhouette: Uint8Array
  readonly originalColor: Uint8Array
  readonly replacementColor: Uint8Array
}

// One row of the difference sheet: the item's label and its views.
export type FidelitySheetRow = {
  readonly label: string
  readonly pictures: readonly ViewPictures[]
}

// Where a view's camera looks from (a direction from the target) and which way is up on its picture.
export type ViewFrame = {
  readonly direction: readonly [number, number, number]
  readonly up: readonly [number, number, number]
}

export type DrawnMesh = Mesh<BufferGeometry, Material | Material[]>
