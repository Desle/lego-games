// An emitter a cinema starts (`0x3c` entry, 0x50 bytes, FUN_004a3ad0): the pool it spawns into (`0x3d`: an index into the
// file's pool names) and the emitter of that pool's list.
export type CinemaEmitterEvent = {
  readonly name: string
  readonly poolIndex: number
  readonly emitterName: string
}

// A vertex colour effect on a material (`0x2b` entry): three integers (`0x2d`) and the material's name (`0x5e`).
// Hypothesis: the flash of the space cinema's sky.
export type CinemaVertexEffect = {
  readonly name: string
  readonly integers: readonly number[]
  readonly materialName: string
}

// The keywords of a list of reactions (`0x50`..`0x57`): an entry of the timeline's section (`0x56`/`0x57`: a dummy) that
// starts (`0x4e`) or stops (`0x4f`) a target: an emitter event (`0x3c`) or a vertex effect (`0x2b`).
export type CinemaReaction = {
  readonly entryName: string
  readonly targetKeyword: number
  readonly targetName: string
}

export type CinemaReactionList = {
  readonly listKeyword: number
  readonly starts: readonly CinemaReaction[]
  readonly stops: readonly CinemaReaction[]
}

export type CinemaEvents = {
  // Keyword 0x27: the emitter files (`MENUDATA\<set>\<name>.EMB`, and the material animation `<name>.MAB`) of the pools.
  readonly poolNames: readonly string[]
  readonly emitterEvents: readonly CinemaEmitterEvent[]
  readonly vertexEffects: readonly CinemaVertexEffect[]
  readonly reactionLists: readonly CinemaReactionList[]
}
