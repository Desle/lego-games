export type BuilderThumbnails = {
  // A picture of the part in the colour, null when the library has no such part.
  readonly getThumbnail: (partName: string, colorCode: number) => Promise<string | null>
}
