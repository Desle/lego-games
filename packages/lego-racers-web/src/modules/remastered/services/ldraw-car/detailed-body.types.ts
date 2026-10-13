import type { Group, Vector3 } from 'three'
import type { DetailSwitch } from './detail-switch.ts'

export type DetailedBody = {
  readonly object: DetailSwitch
  // Resolves when the plain-stud model is drawn; rejects when the library cannot build it.
  readonly shown: Promise<void>
  // Builds the logo-stud model now, if it is not built yet (what a picture of the body wants), and resolves when it is there.
  readonly refined: () => Promise<void>
}

// A wheel taken out of a car's body: its parts gathered in one group that keeps the places they had in the model (LDraw units), and
// its centre.
export type BodyWheel = {
  readonly unit: Group
  readonly centre: Vector3
}
