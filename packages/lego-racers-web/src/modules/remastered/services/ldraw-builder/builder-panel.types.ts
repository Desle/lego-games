import { createEnum } from '../../../../shared/types/enum.types.ts'
import type { EnumValues } from '../../../../shared/types/enum.types.ts'
import type { LDrawColorName } from '../reference-kit/reference-kit.types.ts'
import type { BuilderItem, LibraryPart, StartFileGroup } from './ldraw-builder.types.ts'

// How the original is shown: in a second view with the same camera, see-through over the build, or not at all.
export const ReferenceMode = createEnum({
  SIDE: 'side',
  GHOST: 'ghost',
  OFF: 'off',
})
export type ReferenceMode = EnumValues<typeof ReferenceMode>

export type BuilderPanelElements = {
  readonly queue: HTMLElement
  readonly bar: HTMLElement
  readonly palette: HTMLElement
  readonly help: HTMLElement
  readonly shortcuts: HTMLElement
  readonly status: HTMLElement
}

export type BuilderPanelHandlers = {
  readonly onItemSelect: (itemId: string) => void
  readonly onStartFileSelect: (file: string | null) => void
  readonly onReferenceModeSelect: (mode: ReferenceMode) => void
  readonly onPartSelect: (partName: string) => void
  readonly onColorSelect: (colorCode: number) => void
  readonly onUndo: () => void
  readonly onRedo: () => void
  readonly onRotate: () => void
  readonly onDeleteSelected: () => void
  readonly onDone: () => void
  // A step up (1) or down (-1) of the scale, or back to the fitted scale.
  readonly onScaleStep: (direction: number) => void
  readonly onScaleFit: () => void
  readonly onShortcutsToggle: () => void
  readonly getThumbnail: (
    partName: string,
    colorCode: number,
    getIsWanted: () => boolean
  ) => Promise<string | null>
}

export type BuilderQueueView = {
  readonly items: readonly BuilderItem[]
  readonly done: readonly string[]
  readonly currentId: string
}

export type BuilderToolView = {
  readonly partName: string
  readonly description: string
  readonly colorCode: number
  readonly colorName: string
  readonly isHolding: boolean
}

// The scale control of a power-up object: the factor the file is drawn at and what its reset is called.
export type BuilderScaleView = {
  readonly isShown: boolean
  readonly factor: number
  readonly fitLabel: string
}

export type BuilderPanel = {
  readonly showQueue: (view: BuilderQueueView) => void
  readonly showStartFiles: (groups: readonly StartFileGroup[], selected: string | null) => void
  readonly showReferenceMode: (mode: ReferenceMode) => void
  readonly showLibrary: (parts: readonly LibraryPart[]) => void
  // The parts of the model being built, in the order they were placed, for the Used tab.
  readonly showUsedParts: (partNames: readonly string[]) => void
  readonly showColors: (colors: readonly LDrawColorName[]) => void
  readonly showTool: (tool: BuilderToolView) => void
  readonly showScale: (view: BuilderScaleView) => void
  readonly showStatus: (text: string) => void
  // What a click in the build view does right now.
  readonly showHint: (text: string) => void
  readonly setIsShortcutsShown: (isShown: boolean) => void
  readonly getIsShortcutsShown: () => boolean
  readonly setIsBusy: (isBusy: boolean) => void
}
