// A part of an original's mesh the race draws as one thing: the bones its triangles join (a turbo's burner on one bone, a flame
// on three), drawn by the file once, posed by `bone`, the bone of the group's first vertex.
export type MeshBoneGroup = {
  readonly bone: number
  readonly bones: readonly number[]
}

// A group while the triangles are being joined (its bones grow as later triangles join it).
export type GrowingBoneGroup = {
  readonly bone: number
  readonly bones: Set<number>
}
