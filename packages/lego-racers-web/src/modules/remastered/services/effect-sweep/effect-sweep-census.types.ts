import type { Object3D } from 'three'
import type {
  EffectElementKind,
  EffectOrigin,
} from '../../../../shared/effect-sweep/effect-sweep.types.ts'

// An effect element a rendered scene draws, with the object to hide when its pixels are measured.
export type EffectElement = {
  readonly origin: EffectOrigin
  readonly kind: EffectElementKind
  readonly key: string
  readonly object: Object3D
  // A layer's drawing with no mesh (drawn in place of something to show nothing: a shield's inside).
  readonly isEmpty: boolean
  // The separately posed parts of a layer's drawing; 1 for an original object.
  readonly partCount: number
}

// The model or particle material a layer's drawing was asked for.
export type LayerEffect = {
  readonly kind: EffectElementKind
  readonly key: string
}

// The layer's effect an object is the drawing of; null when it is none.
export type LayerEffectReader = (object: Object3D) => LayerEffect | null
