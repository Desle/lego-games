import type { PowerUpEvent } from '../../../power-ups/index.ts'

export type ExplosionEvent = Extract<PowerUpEvent, { readonly type: 'power_ups.explosion' }>
