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
})
export type BuilderItemKind = EnumValues<typeof BuilderItemKind>

// One thing to build: a chassis recipe (`chassis/<NAME>.ldr`) or a champion's whole car but its wheels (`<CODE>.ldr`).
export type BuilderItem = {
  readonly id: string
  readonly kind: BuilderItemKind
  // The chassis name (lower case) or the car code (upper case).
  readonly name: string
  // The chassis a car's wheels are on (lower case), which gives its wheel guides; for a chassis, its own name.
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

export type BuilderSaveResult = {
  readonly path: string
  readonly backupPath: string | null
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

// A labelled group of the Start from menu (Cars, Chassis, Backups/drafts).
export type StartFileGroup = {
  readonly label: string
  readonly files: readonly string[]
}
