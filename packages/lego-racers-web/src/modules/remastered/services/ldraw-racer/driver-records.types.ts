// A driver's file in the models folder (relative to it) and the part bytes of his driver database record (the pictures of his face and
// torso come from the figure builder's model of them).
export type DriverFileSource = {
  readonly file: string
  readonly partBytes: readonly number[]
}
