export {
  compareAudioCalls,
  getOriginalAudioCalls,
  LOOPED_SOUND_ID_OFFSET,
} from './controller/audio-trace/audio-trace.ts'
export {
  compareQuadPlacements,
  getBoundingRectangle,
  getOriginalQuads,
} from './controller/render-trace/compare-quads.ts'
export { compareRenderFrameByRoot } from './controller/render-trace/compare-by-root.ts'
export type {
  RootChoice,
  RootComparison,
  RootComparisonInput,
} from './controller/render-trace/compare-by-root.types.ts'
export {
  getIsCutPiece,
  getIsFragmentOfPolygon,
} from './controller/render-trace/clipped-polygon/clipped-polygon.ts'
export { compareRenderFrame, getIsInside } from './controller/render-trace/compare-render-frame.ts'
export { getOriginalTriangles } from './controller/render-trace/original-triangles.ts'
export {
  getIsFrontFacing,
  getCandidateMatrices,
  projectWorldTriangle,
} from './controller/render-trace/screen-projection.ts'
export { matchTextures } from './controller/render-trace/texture-matching.ts'
export type { TextureMatch } from './controller/render-trace/texture-matching.types.ts'
export {
  getIsOriginalPresentationAvailable,
  readOriginalFrontEnd,
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
  ClippedPolygon,
  DepthRange,
  DrawnTriangle,
  DrawState,
  PortTexture,
  QuadComparison,
  QuadPlacement,
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
  OriginalDecal,
  OriginalDecalFrame,
  OriginalDecalTriangle,
  OriginalDraw,
  OriginalPresentation,
  OriginalScreenEvent,
  OriginalRenderFrame,
  OriginalRenderState,
  OriginalTexture,
  OriginalVertex,
  OriginalViewport,
  FrontEndScenario,
  PresentationFrameInput,
  PresentationScenario,
} from './types/presentation-trace.types.ts'
export { comparePixels } from './controller/pixel-trace/compare-pixels/compare-pixels.ts'
export { rasteriseFrame } from './controller/pixel-trace/rasterise-frame/rasterise-frame.ts'
export type {
  PixelComparison,
  PixelComparisonInput,
  PixelImage,
  PixelRegion,
  PixelTolerance,
  RasterisedFrame,
  RasteriseOptions,
  TextureCoverage,
} from './controller/pixel-trace/pixel-trace.types.ts'
