import type { TextureCreatedEvent, ViewerExtension } from './viewer-extensions.types.ts'

let registeredExtensions: readonly ViewerExtension[] = Object.freeze([])

export const registerViewerExtension = (extension: ViewerExtension) => {
  registeredExtensions = Object.freeze([...registeredExtensions, extension])
}

export const clearViewerExtensions = () => {
  registeredExtensions = Object.freeze([])
}

export const getViewerExtensions = (): readonly ViewerExtension[] => registeredExtensions

export const getIsClassic = (): boolean => registeredExtensions.length === 0

export const emitTextureCreated = (event: TextureCreatedEvent) => {
  for (const extension of registeredExtensions) extension.onTextureCreated(event)
}
