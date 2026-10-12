import type { DevelopmentToolsState } from './development-tools-state.types.ts'

let isOverlayOpen = false
const listeners = new Set<() => void>()

// Whether the developer overlay is open, shared by the overlay and the development keys that only work while it is.
export const developmentToolsState: DevelopmentToolsState = Object.freeze({
  getIsOpen: () => isOverlayOpen,
  setIsOpen: (isOpen: boolean) => {
    isOverlayOpen = isOpen
    listeners.forEach((listener) => listener())
  },
  subscribe: (listener: () => void) => {
    listeners.add(listener)
    return () => void listeners.delete(listener)
  },
})
