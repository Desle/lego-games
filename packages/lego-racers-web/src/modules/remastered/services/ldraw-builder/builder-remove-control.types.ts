// The open item's file, when the models folder has one the game draws instead of the original.
export type BuilderRemoveView = {
  readonly isShown: boolean
  readonly file: string
}

export type BuilderRemoveControl = {
  readonly element: HTMLElement
  readonly show: (view: BuilderRemoveView) => void
  readonly setIsBusy: (isBusy: boolean) => void
}
