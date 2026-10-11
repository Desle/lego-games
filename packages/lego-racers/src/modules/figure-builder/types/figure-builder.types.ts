// A name with the integer that follows it in the catalogue (what the integer means is not read by the race).
export type CatalogEntry = {
  readonly name: string
  readonly value: number
}

// A torso or legs entry of the catalogue: the material's name, the body type (0 or 1: which torso or legs mesh the menu
// shows, `chests` or `chest_hk`, `legss` or `leg-pegs`) and one more integer.
export type CatalogBodyEntry = {
  readonly name: string
  readonly type: number
  readonly value: number
}

// A group of entries with the names of the meshes the menu shows for them.
export type CatalogGroup<Entry> = {
  readonly meshNames: readonly string[]
  readonly entries: readonly Entry[]
}

// `BODYPART.PCB` (BodyPartCatalog_Load 0x00498740 and its section readers 0x004988a0 to 0x00498e40): which parts a minifigure
// can be made of. A driver's five part bytes index these lists.
export type BodyPartCatalog = {
  // `0x28`: the part directories, index 0 for the menu, 1 for the game (`MENUDATA\PARTDB\GAMEPART`).
  readonly directories: readonly string[]
  // `0x27`: the world files of each directory (selector, cbbodies, icb_char).
  readonly worldNames: readonly string[]
  // `0x29`: the hats' material names and their integer.
  readonly hats: readonly CatalogEntry[]
  // `0x2d`: the hats' mesh names, in the same order.
  readonly hatMeshNames: readonly string[]
  // `0x2a`: the heads: the mesh name (`heads`) and for each face the prefix of its texture names (`kk_`).
  readonly heads: CatalogGroup<CatalogEntry>
  // `0x2b` and `0x2c`.
  readonly torsos: CatalogGroup<CatalogBodyEntry>
  readonly legs: CatalogGroup<CatalogBodyEntry>
  // `0x2e`: the body models (`rr hr rp hp leg_box`); the game always uses the last (`0x00498510`).
  readonly bodyModelNames: readonly string[]
  // `0x2f`: `hat face torso legs`.
  readonly boneNames: readonly string[]
}

// One group of a part (a named material and its triangles).
export type PartGroup = {
  readonly materialName: string
  // Three vertex indices per triangle, into the file's vertex pool.
  readonly triangles: Uint16Array
}

// A named part of a geometry file (a hat, the head, ...): its model scale and its groups.
export type GeometryPart = {
  readonly name: string
  readonly scale: number
  readonly groups: readonly PartGroup[]
}

// `.GCB` (BuilderGeometry_Load 0x00407690): a vertex pool and named parts. A pool is either of lit vertices (keyword `0x28`,
// with normals) or of coloured ones (`0x29`, with a colour); the file holds one of them.
export type PartGeometry = {
  // x, y, z per vertex, raw 16-bit values (the part's scale applies).
  readonly positions: Float32Array
  // u, v per vertex, divided by 4096 (0x004af4ac).
  readonly textureCoordinates: Float32Array
  // x, y, z per vertex divided by 127 (0x004af4b0); null for a pool of coloured vertices.
  readonly normals: Float32Array | null
  // r, g, b, a per vertex; null for a pool of lit vertices.
  readonly colors: Uint8Array | null
  readonly parts: readonly GeometryPart[]
}

// A triangle batch of a driver's model: the material it is drawn with (looked up by name in the part material library),
// the bone each corner follows, and, for the three materials the figure replaces, the tint that replaces the library's.
export type DriverBatch = {
  readonly materialName: string
  // Three vertex indices per triangle.
  readonly vertexIndices: Uint32Array
  // One bone (transform) index per corner.
  readonly transformIndices: Uint8Array
  readonly tint: readonly [number, number, number, number] | null
}

// The model 0x0049dab0 makes for a driver: the box body of the game (`leg_box`: legs, torso, arms) with the head and hat
// of the catalogue on the face bone.
export type DriverModel = {
  readonly positions: Float32Array
  readonly normals: Float32Array
  readonly textureCoordinates: Float32Array
  readonly batches: readonly DriverBatch[]
  // The model's scale (the body's, GDB key `0x33`).
  readonly scale: number
}

export type VertexPool = Pick<
  PartGeometry,
  'positions' | 'textureCoordinates' | 'normals' | 'colors'
>
