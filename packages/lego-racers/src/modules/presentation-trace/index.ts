export { compareAudioCalls, getOriginalAudioCalls } from './controller/audio-trace/audio-trace.ts'
export { compareRenderFrame } from './controller/render-trace/compare-render-frame.ts'
export { getOriginalTriangles } from './controller/render-trace/original-triangles.ts'
export {
  getIsFrontFacing,
  getWorldToScreenMatrix,
  projectWorldTriangle,
} from './controller/render-trace/screen-projection.ts'
export { matchTextures } from './controller/render-trace/texture-matching.ts'
export type { TextureMatch } from './controller/render-trace/texture-matching.types.ts'
export {
  getIsOriginalPresentationAvailable,
  readOriginalPresentation,
} from './services/original-presentation/original-presentation.ts'
export type {
  AudioCall,
  AudioComparison,
  AudioFrameCalls,
  MusicCall,
  MusicDifference,
  SoundCall,
  SoundSummary,
} from './controller/audio-trace/audio-trace.types.ts'
export { RenderMismatchKind } from './types/render-mismatch-kind/render-mismatch-kind.ts'
export type {
  DrawnTriangle,
  DrawState,
  PortTexture,
  RenderFrameInput,
  RenderFrameComparison,
  RenderMismatchGroup,
  RenderTolerances,
  RenderViewportSize,
  ScreenMatrix,
  ScreenTriangle,
  ScreenVertex,
  WorldTriangle,
  WorldVertex,
} from './controller/render-trace/render-trace.types.ts'
export type {
  OriginalAudioEvent,
  OriginalAudioFrame,
  OriginalDraw,
  OriginalPresentation,
  OriginalRenderFrame,
  OriginalRenderState,
  OriginalTexture,
  OriginalVertex,
  OriginalViewport,
  PresentationFrameInput,
  PresentationScenario,
} from './types/presentation-trace.types.ts'
