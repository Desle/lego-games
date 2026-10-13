// What a kind of particle (or a power-up sprite) is drawn with: a model's text (its file's, or the kind's part), the scale its
// pieces are drawn at (powerup-object-frame.ts), the models folder's file it came from (null for the kind's part) and whether its
// pieces follow the particles' size rule (ldraw-particle-size.ts; a power-up sprite's file is drawn at its scale).
export type ParticleKindModel = {
  readonly modelText: string
  readonly scale: number
  readonly file: string | null
  readonly isSizeCapped: boolean
}
