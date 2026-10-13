import type { DetailSwitch } from '../detail-switch/detail-switch.ts'

export type DetailedBody = {
  readonly object: DetailSwitch
  // Resolves when the plain-stud model is drawn; rejects when the library cannot build it.
  readonly shown: Promise<void>
  // Builds the logo-stud model now, if it is not built yet (what a picture of the body wants), and resolves when it is there.
  readonly refined: () => Promise<void>
}
