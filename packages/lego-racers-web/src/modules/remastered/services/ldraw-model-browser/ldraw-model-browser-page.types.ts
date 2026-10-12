import type { Object3D, Scene } from 'three'

// What the page draws for the selected file: the hand-built model and, when the file name is a car code or a chassis name, the
// original's model beside it.
export type BrowserScenes = {
  readonly model: Object3D
  readonly original: Object3D | null
}

// The same, each in a scene of its own.
export type DrawnScenes = {
  readonly model: Scene
  readonly original: Scene | null
}
