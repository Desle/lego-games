// What a kind of particle is drawn with: a model's text (its file's, or the kind's part), the scale its pieces are drawn at
// (powerup-object-frame.ts) and the models folder's file it came from (null for the kind's part).
export type ParticleKindModel = {
  readonly modelText: string
  readonly scale: number
  readonly file: string | null
}
