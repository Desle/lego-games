export type Vector3 = readonly [number, number, number]

// Every name the RAB gives; null when its keyword is absent and the race object keeps its value.
export type RaceDescription = {
  readonly displayName: string
  readonly trackWorld: string | null
  readonly backgroundWorld: string | null
  readonly blendedWorld: string | null
  readonly globalWorld: string | null
  readonly localWorld: string | null
  readonly shadowWorld: string | null
  readonly collisionWorld: string | null
  // Looked up inside the collision world by 0x00432e20 (race +0x3b0 and +0x3b4).
  readonly firstCollisionObject: string | null
  readonly secondCollisionObject: string | null
  readonly sky: string | null
  readonly startPositions: string | null
  readonly events: string | null
  readonly fontDatabase: string | null
  readonly imageDatabase: string | null
  readonly soundBank: string | null
  readonly voiceFolder: string | null
  readonly trackSoundBank: string | null
  readonly musicList: string | null
  readonly powerUpPlacements: string | null
  readonly powerUpMaterialAnimation: string | null
  readonly powerUpWorld: string | null
  readonly mainTriggers: string | null
  readonly environmentTriggers: string | null
  readonly timers: string | null
  readonly emitterDefinitions: string | null
  readonly trackEmitters: string | null
  readonly hazards: string | null
  readonly trackMaterials: string | null
  readonly checkpoints: string | null
  // Looked up inside the collision world.
  readonly checkpointObject: string | null
  // Looked up inside the track world by 0x00432e20 (race +0x3ac).
  readonly trackWorldObject: string | null
  readonly taggedPositions: string | null
  // Passed to the camera by 0x00433480 (0x00428390 and 0x004282a0).
  readonly cameraPoint: Vector3 | null
  readonly cameraVectors: readonly [Vector3, Vector3] | null
  // In file order; stored at +0x2abc, +0x2ac4, +0x2ac0, +0x2ac8 and passed to 0x00426280.
  readonly displayBounds: readonly [number, number, number, number] | null
  readonly readByteCount: number
}
