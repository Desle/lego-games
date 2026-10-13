// What a removal did: the model file it took out of use and where it moved it, both relative to the models folder.
export type LDrawModelRemoveResult = {
  readonly path: string
  readonly backupPath: string
}
