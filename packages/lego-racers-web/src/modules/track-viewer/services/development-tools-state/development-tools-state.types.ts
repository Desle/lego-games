export type DevelopmentToolsState = {
  readonly getIsOpen: () => boolean
  readonly setIsOpen: (isOpen: boolean) => void
  readonly subscribe: (listener: () => void) => () => void
}
