// An emitter a cinema starts (`0x3c` entry, 0x50 bytes, FUN_004a3ad0): the pool it spawns into (`0x3d`: an index into the
// file's pool names) and the emitter of that pool's list.
export type CinemaEmitterEvent = {
  readonly name: string
  readonly poolIndex: number
  readonly emitterName: string
}

// A vertex colour effect on a model instance (`0x2b` entry, FUN_004a4be0): the shifts (`0x2c`, three integers), the biases it
// starts with (`0x2d`, three integers) and the model instance it acts on (`0x5e`, FUN_004a3230). Starting it gives the model's
// vertex colours `(channel >> shift) + bias` (GolDP.dll 0x10017050, `FUN_004a4ca0`); stopping it takes that off
// (`FUN_004a4cf0`). The rates (`0x2e`, three floats) change the biases every frame (`FUN_004a4d10`); no shipped file sets them.
export type CinemaVertexEffect = {
  readonly name: string
  readonly shifts: readonly number[]
  readonly biases: readonly number[]
  readonly rates: readonly number[]
  readonly instanceName: string
}

// A vertex effect a dummy on the timeline has started.
export type ActiveCinemaVertexEffect = {
  readonly dummyIndex: number
  readonly effect: CinemaVertexEffect
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
