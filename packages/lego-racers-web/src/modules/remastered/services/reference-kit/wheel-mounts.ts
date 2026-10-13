import type { JamArchive } from '@lego-games/lego-racers/jam-archive'
import {
  getBuiltRacerAppearance,
  getRacerModelFiles,
} from '@lego-games/lego-racers/racer-appearance'
import { readRacerDatabases } from '@lego-games/lego-racers/race'
import { loadModelScene } from '@lego-games/lego-racers/scene'
import { Vector3 } from 'three'
import { createSkeletonPoseSampler } from '../ldraw-racer/skeleton-pose.ts'
import { findWheels } from '../ldraw-racer/wheel-analysis.ts'
import type { WheelMount } from './reference-kit.types.ts'

const AXIS_NAMES: readonly string[] = ['x', 'y', 'z']

const getLargestAxis = (direction: Vector3): string => {
  const components = [Math.abs(direction.x), Math.abs(direction.y), Math.abs(direction.z)]
  return AXIS_NAMES[components.indexOf(Math.max(...components))] ?? 'y'
}

// Where the game puts the wheels of a chassis, in the car's frame in studs: the centre of each wheel of the chassis's wheel model at
// rest (its bone's matrix applied), its radius and width, and the axis it turns about. These are the places the automatic LDraw wheels
// take and the places a hand-built car has to leave room at.
export const getWheelMounts = (archive: JamArchive, chassisName: string): readonly WheelMount[] => {
  const names = getBuiltRacerAppearance(
    readRacerDatabases(archive.readFile),
    chassisName,
    0
  ).wheelModel
  const model = loadModelScene(archive, getRacerModelFiles(names))
  const mesh = model.scene.meshes[model.scene.instances[0]?.levels[0]?.meshIndex ?? -1]
  const sampler = createSkeletonPoseSampler(model)
  if (mesh === undefined || sampler === null) return []
  const scale = model.meshScales[0] ?? 1
  return findWheels(mesh).flatMap((wheel): readonly WheelMount[] => {
    const bone = sampler.restMatrices[wheel.boneIndex]
    if (bone === undefined) return []
    const centre = new Vector3(...(wheel.centre as [number, number, number]))
      .applyMatrix4(bone)
      .multiplyScalar(scale)
    const axis = new Vector3()
    axis.setComponent(wheel.axisIndex, 1)
    return [
      {
        centre: [centre.x, centre.y, centre.z],
        radius: wheel.radius * scale,
        width: wheel.width * scale,
        axle: getLargestAxis(axis.transformDirection(bone)),
      },
    ]
  })
}
