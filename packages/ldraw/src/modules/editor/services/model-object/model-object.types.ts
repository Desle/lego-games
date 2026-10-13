import type { Object3D } from 'three'

// A drawable copy of a prepared model; release lets go of the shared model it copies once the copy leaves the screen.
export type HeldModelObject = {
  readonly object: Object3D
  readonly release: () => void
}
