import type { Object3D } from 'three'
import type {
  BuiltCarDrawingRequest,
  TextureCreatedEvent,
  ViewerExtension,
} from './viewer-extensions.types.ts'

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

export const getBuiltCarDrawing = (request: BuiltCarDrawingRequest): Object3D | null => {
  for (const extension of registeredExtensions) {
    const drawing = extension.getBuiltCarDrawing?.(request) ?? null
    if (drawing !== null) return drawing
  }
  return null
}
