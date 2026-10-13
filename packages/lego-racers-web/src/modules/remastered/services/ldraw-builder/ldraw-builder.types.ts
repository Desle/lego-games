import { createEnum } from '../../../../shared/types/enum.types.ts'
import type { EnumValues } from '../../../../shared/types/enum.types.ts'
import type { BuilderPart } from '@lego-games/ldraw/building'

export type {
  BuilderBox,
  BuilderDocument,
  BuilderHistory,
  BuilderPart,
  BuilderPartLine,
  PlacementTarget,
  Vector,
} from '@lego-games/ldraw/building'

export const BuilderItemKind = createEnum({
  CHASSIS: 'chassis',
  CAR: 'car',
  DRIVER: 'driver',
  POWER_UP: 'power_up',
  PARTICLE: 'particle',
})
export type BuilderItemKind = EnumValues<typeof BuilderItemKind>

// One thing to build: a chassis recipe (`chassis/<NAME>.ldr`), a champion's whole car but its wheels (`<CODE>.ldr`), a driver's
// minifigure (`drivers/<NAME>.ldr`), a power-up object (`powerups/<MODEL>.ldr`) or a kind of particle (`particles/<KIND>.ldr`).
export type BuilderItem = {
  readonly id: string
  readonly kind: BuilderItemKind
  // The chassis name (lower case), the car code, the driver's name, the power-up object's model name or the particle's kind (upper
  // case).
  readonly name: string
  // The chassis a car's wheels are on (lower case), which gives its wheel guides; for a chassis, its own name; for a driver or a
  // power-up object, empty.
  readonly chassisName: string
}

// A part of the LDraw library, by file name, with the description of its first line.
export type LibraryPart = {
  readonly name: string
  readonly description: string
}

export type BuilderProgress = {
  readonly done: readonly string[]
}

export type BuilderSaveRequest = {
  readonly itemId: string
  readonly text: string
}

// What the builder adds to a save's answer.
export type BuilderSaveProgress = {
  readonly progress: BuilderProgress
}

export type BuilderSaveResult = {
  readonly path: string
  readonly backupPath: string | null
  readonly progress: BuilderProgress
}

export type BuilderRemoveRequest = {
  readonly itemId: string
}

// The item's file moved into the backups, and the progress without its mark.
export type BuilderRemoveResult = {
  readonly path: string
  readonly backupPath: string
  readonly progress: BuilderProgress
}

export type PaletteGroup = {
  readonly label: string
  readonly parts: readonly LibraryPart[]
}

export type CommonPartGroup = {
  readonly label: string
  readonly partNames: readonly string[]
}

// Unsaved work kept in the browser: the parts and when they were last changed.
export type BuilderDraft = {
  readonly savedAt: number
  readonly parts: readonly BuilderPart[]
}

// A labelled group of the Start from menu (Cars, Chassis, Drivers, Power-ups, Backups/drafts).
export type StartFileGroup = {
  readonly label: string
  readonly files: readonly string[]
}
