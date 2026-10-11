export {
  compareAudioCalls,
  getOriginalAudioCalls,
} from './controller/audio-trace/audio-trace.ts'
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
