import type { Vector3 } from '../../../simulation-math/index.ts'
import type { TrackMaterial } from '../../../track-material/index.ts'

// The properties the race gives the materials of its collision world: Race_LoadRaceDescription's 0x00435d20 sets
// every BVB material's property (+0x14) to the track-material entry of the same name (0 when the race has none),
// and 0x00435e70 gives the checkpoint object's digit-named materials the next checkpoint instead.
export type SurfaceMaterials = {
  // The track-material entries by name (the hash table at race +0x27e0, 0x004119a0).
  readonly trackMaterials: ReadonlyMap<string, TrackMaterial>
  // The checkpoint object's materials whose name starts with a digit, in list order: the n-th one is checkpoint n.
  readonly checkpointIndices: ReadonlyMap<string, number>
  // The place of the checkpoint object (race +0x3b8) in every car rigid body's collision list (+0x144 is entry 1);
  // null when the race has none (car body +0x6fc is 0).
  readonly checkpointObjectIndex: number | null
}

// What the car body's contact filter (0x0042a830) and the end of every pass (0x0042a900) ask the race to do, in the
// order they happen. The race applies them once the rigid body step returns.
export type CarBodyContact =
  // 0x00439fc0 with the checkpoint and the triangle's normal (the contact record's +0x24).
  | {
      readonly type: 'checkpoint_touched'
      readonly checkpointIndex: number
      readonly direction: Vector3
    }
  // A material flagged 0x40000: racer +0xce4 = +0xce0 (the lap count).
  | { readonly type: 'finish_touched' }
  // A hull point met a material with the event flag 0x8: 0x00462580 and 0x00462ae0 with its identifier.
  | { readonly type: 'surface_hit'; readonly identifier: number; readonly point: Vector3 }
  // A wheel's material changed (0x0042aa30, 0x0042aa70): the entered one fires its identifier, the left one releases.
  | { readonly type: 'surface_entered'; readonly identifier: number; readonly position: Vector3 }
  | { readonly type: 'surface_left'; readonly identifier: number; readonly position: Vector3 }
  // 0x0042aad0 and 0x0042acb0: the vehicle's surface emitter of a wheel starts under the material's emitter name
  // (0x0043dd50) or stops (0x0043de90).
  | { readonly type: 'wheel_emitter_started'; readonly wheelIndex: number; readonly name: string }
  | { readonly type: 'wheel_emitter_stopped'; readonly wheelIndex: number }
  // 0x0042aad0 hands the sound of a material with flag 0x80 to 0x0042af90, and 0x0042aa70 stops it when the wheel that
  // left that material was the last on it.
  | { readonly type: 'wheel_surface_sound'; readonly soundId: number }
  | { readonly type: 'wheel_surface_left'; readonly soundId: number }

// Asks the car body's surface walk to record the vehicle's wheel emitters as well (a computer's never run).
export type WheelEmitterOptions = {
  readonly isComputer: boolean
}

export type CarBodyContactRecorder = (contact: CarBodyContact) => void
