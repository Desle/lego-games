export type MaterialRegistry = {
  // The glTF material of the scene's material at that index.
  readonly getMaterialIndex: (sceneMaterialIndex: number) => number
}
