import type { Object3D } from 'three'
import type {
  BuiltCarDrawingRequest,
  EffectModelDrawingRequest,
  PictureCreatedEvent,
  TextureCreatedEvent,
  ViewerExtension,
} from './viewer-extensions.types.ts'

// An extension with no opinion on anything: a base to override what a layer changes.
export const NEUTRAL_EXTENSION: ViewerExtension = Object.freeze({
  onTextureCreated: () => undefined,
  onPictureCreated: () => undefined,
  getRaceDisplay: () => null,
  getMenuSurfaceScale: () => null,
  getSoundReplacement: () => Promise.resolve(null),
  getBuiltCarDrawing: () => null,
  getEffectModelDrawing: () => null,
  getSelections: () => [],
})

let registeredExtensions: readonly ViewerExtension[] = Object.freeze([])

export const registerViewerExtension = (extension: ViewerExtension) => {
  registeredExtensions = Object.freeze([...registeredExtensions, extension])
}

export const clearViewerExtensions = () => {
  registeredExtensions = Object.freeze([])
}

export const getViewerExtensions = (): readonly ViewerExtension[] => registeredExtensions

export const getIsClassic = (): boolean => registeredExtensions.length === 0

export const getExtensionSelections = (): readonly string[] =>
  registeredExtensions.flatMap((extension) => extension.getSelections())

export const emitTextureCreated = (event: TextureCreatedEvent) => {
  for (const extension of registeredExtensions) extension.onTextureCreated(event)
}

export const emitPictureCreated = (event: PictureCreatedEvent) => {
  for (const extension of registeredExtensions) extension.onPictureCreated(event)
}

// 1 (the design's own resolution) when no extension asks for more.
export const getMenuSurfaceScale = (devicePixelsPerDesignPixel: number): number => {
  for (const extension of registeredExtensions) {
    const scale = extension.getMenuSurfaceScale(devicePixelsPerDesignPixel)
    if (scale !== null) return scale
  }
  return 1
}

export const getSoundReplacement = async (
  context: BaseAudioContext,
  archivePath: string
): Promise<AudioBuffer | null> => {
  for (const extension of registeredExtensions) {
    const buffer = await extension.getSoundReplacement(context, archivePath)
    if (buffer !== null) return buffer
  }
  return null
}

export const getBuiltCarDrawing = (request: BuiltCarDrawingRequest): Object3D | null => {
  for (const extension of registeredExtensions) {
    const drawing = extension.getBuiltCarDrawing(request)
    if (drawing !== null) return drawing
  }
  return null
}

export const getEffectModelDrawing = (request: EffectModelDrawingRequest): Object3D | null => {
  for (const extension of registeredExtensions) {
    const drawing = extension.getEffectModelDrawing(request)
    if (drawing !== null) return drawing
  }
  return null
}
