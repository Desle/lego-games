import { getLitVertexColor } from '@lego-games/lego-racers/cinema'
import type { LightChannels } from '@lego-games/lego-racers/cinema'
import type { RaceCinemaView } from '@lego-games/lego-racers/front-end'
import type { JamArchive } from '@lego-games/lego-racers/jam-archive'
import { getTransformedNormals } from '@lego-games/lego-racers/skeletal-animation'
import { getCinemaFigurePose } from './figure-frames.ts'

const NORMAL_SIZE = 3

// The colours (as 0xRRGGBB) the port gives the vertices of the champion's figure in a race preview: the figure's normals
// rotated by its pose and by the guy1 action's frame, lit by the cinema's ambient and directional light.
export const getCinemaFigureColors = (
  archive: JamArchive,
  view: RaceCinemaView
): ReadonlySet<number> => {
  const colors = new Set<number>()
  const pose = getCinemaFigurePose(archive, view)
  const ambientLight = pose?.cinema.ambientLights[0]
  const directionalLight = pose?.cinema.directionalLights[0]
  const mesh = pose?.scene.meshes[0]
  if (
    pose === null ||
    ambientLight === undefined ||
    directionalLight?.direction === null ||
    directionalLight === undefined ||
    mesh?.normals === null ||
    mesh === undefined
  )
    return colors
  const { action, matrices, scene, side } = pose
  const [forwardX, forwardY, forwardZ] = action.forward
  const [upX, upY, upZ] = action.up
  const light = {
    color: [directionalLight.red, directionalLight.green, directionalLight.blue] as LightChannels,
    direction: directionalLight.direction,
  }
  const ambient: LightChannels = [ambientLight.red, ambientLight.green, ambientLight.blue]
  for (const batch of mesh.drawBatches) {
    const material = scene.materials[mesh.materialIndices[batch.materialSlot] ?? -1]
    if (material === undefined) continue
    const restNormals = new Float32Array(batch.vertexIndices.length * NORMAL_SIZE)
    batch.vertexIndices.forEach((vertex, corner) =>
      restNormals.set(mesh.normals?.subarray(vertex * 3, vertex * 3 + 3) ?? [], corner * 3)
    )
    const normals = getTransformedNormals(restNormals, batch.transformIndices, matrices)
    for (let corner = 0; corner < batch.vertexIndices.length; corner += 1) {
      const x = normals[corner * 3] ?? 0
      const y = normals[corner * 3 + 1] ?? 0
      const z = normals[corner * 3 + 2] ?? 0
      const [red, green, blue] = getLitVertexColor({
        ambient,
        materialAmbient: [
          material.ambientColor[0],
          material.ambientColor[1],
          material.ambientColor[2],
        ],
        materialDiffuse: [
          material.diffuseColor[0],
          material.diffuseColor[1],
          material.diffuseColor[2],
        ],
        lights: [light],
        normal: [
          x * forwardX + y * side[0] + z * upX,
          x * forwardY + y * side[1] + z * upY,
          x * forwardZ + y * side[2] + z * upZ,
        ],
      })
      colors.add((red << 16) | (green << 8) | blue)
    }
  }
  return colors
}
