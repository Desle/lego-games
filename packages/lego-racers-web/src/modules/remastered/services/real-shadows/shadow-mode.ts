import { ShadowMode } from './shadow-mode.types.ts'

export const SHADOWS_PARAMETER = 'shadows'
export const REAL_SHADOWS_LABEL = 'Real'
export const SCENERY_SHADOWS_LABEL = 'Real + scenery'

const MODES: readonly ShadowMode[] = Object.values(ShadowMode)

// Real shadows are on with `?hd`; `shadows=classic` keeps the original's blobs and `shadows=scenery` lets static scenery cast too.
export const getShadowMode = (search: string): ShadowMode => {
  const requested = new URLSearchParams(search).get(SHADOWS_PARAMETER)
  return MODES.find((mode) => mode === requested) ?? ShadowMode.REAL
}

export const getShadowModeLabel = (mode: ShadowMode): string | null => {
  if (mode === ShadowMode.REAL) return REAL_SHADOWS_LABEL
  return mode === ShadowMode.SCENERY ? SCENERY_SHADOWS_LABEL : null
}

export const getShadowModeFromLabel = (label: string | null): ShadowMode => {
  if (label === REAL_SHADOWS_LABEL) return ShadowMode.REAL
  return label === SCENERY_SHADOWS_LABEL ? ShadowMode.SCENERY : ShadowMode.CLASSIC
}
