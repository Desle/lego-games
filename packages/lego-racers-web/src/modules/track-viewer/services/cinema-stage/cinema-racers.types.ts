import type { SceneInstance } from '@lego-games/lego-racers/scene'
import type { SkeletonAnimationState } from '@lego-games/lego-racers/skeletal-animation'
import type { Matrix4, Object3D } from 'three'
import type { FollowedDrawing } from '../racer-drawing/racer-drawing.types.ts'

// A row-major 3 x 3 turn made of whole quarter turns: each row has one entry of 1 or -1.
export type QuarterTurn = readonly [
  readonly [number, number, number],
  readonly [number, number, number],
  readonly [number, number, number],
]

// A champion's car as a cinema world draws it: its own model of the car (the instance's mesh, or on a skeleton the bone that carries
// the body), the race's body code it copies, the cinema's instances that draw its wheels apart, and where the race car's frame (studs,
// x forward, z up: the body model and the chassis's wheels at rest) lies in the mesh's frame: `scale · turn · point + offset`.
export type CinemaCar = {
  readonly carCode: string
  readonly wheelInstanceNames: readonly string[]
  readonly turn: QuarterTurn
  readonly scale: number
  readonly offset: readonly [number, number, number]
}

// A racer of a cinema world: its instance, the group the viewer draws it in, how to ask for its drawing (added to `host`), and the
// frame of the drawing in the instance's for the state its skeleton is in.
export type CinemaRacer = {
  readonly instance: SceneInstance
  readonly group: Object3D
  readonly create: (host: Object3D) => FollowedDrawing | null
  readonly getFrame: (state: SkeletonAnimationState | null) => Matrix4
}

// The racers of a cinema world drawn by a viewer extension: `sync` hands them where their instances are after the stage has posed
// the world for a frame.
export type CinemaRacers = {
  readonly sync: () => void
  readonly dispose: () => void
}
