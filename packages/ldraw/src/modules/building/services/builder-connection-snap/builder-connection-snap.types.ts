import type {
  ConnectionKind,
  PartConnection,
} from '../builder-connections/builder-connections.types.ts'
import type { Vector } from '../../types/building.types.ts'

export type ConnectionSnapOptions = {
  // Where a point of the editing frame is on the screen, in pixels.
  readonly project: (point: Vector) => readonly [number, number]
  // How near on the screen a connection of the moving parts must come to one of the others.
  readonly radius: number
  // Whether the moving part may turn to meet a minifigure joint (one part moving alone).
  readonly isTurnAllowed: boolean
  // The ground: a receptacle resting on it (or below it) takes no stud.
  readonly groundHeight: number
  // The cursor on the screen, in pixels (null without one): pointing at a minifigure joint joins it.
  readonly pointer: readonly [number, number] | null
  // Whether a move of the parts (from where they are given) is allowed: a drag held to one axis or to up and down.
  readonly getIsOffsetAllowed: (offset: Vector) => boolean
}

// Where joining moves the parts: every moving part by `offset`, and the one moving part turned to `rotation` (null: it keeps its turn).
export type ConnectionSnap = {
  readonly offset: Vector
  readonly rotation: readonly number[] | null
  // The joined connection in the editing frame, for its highlight.
  readonly target: Vector
  readonly kind: ConnectionKind
  // How far apart on the screen the two connections were, in pixels.
  readonly distance: number
}

// A snap with how it ranks: its distance on the screen plus how far apart the two connections are in the model.
export type ScoredSnap = ConnectionSnap & { readonly score: number }

// A connection of a placed part in the editing frame (its part's index among the parts it was found on).
export type PlacedConnection = {
  readonly connection: PartConnection
  readonly partIndex: number
  readonly position: Vector
  readonly direction: Vector
  readonly rotation: readonly number[]
}
