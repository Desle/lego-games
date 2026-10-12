import {
  getActiveCinemaActions,
  getCinemaLoopMilliseconds,
  getLitVertexColor,
  parseCinemaDatabase,
} from '@lego-games/lego-racers/cinema'
import type { LightChannels } from '@lego-games/lego-racers/cinema'
import type { RaceCinemaView } from '@lego-games/lego-racers/front-end'
import type { JamArchive } from '@lego-games/lego-racers/jam-archive'
import { loadMenuDriverScene } from '@lego-games/lego-racers/racer-appearance'
import {
  advanceSkeletonAnimation,
  createSkeletonAnimationState,
  getBoneMatrices,
  getRestPose,
  getSkeletonPose,
  getTransformedNormals,
} from '@lego-games/lego-racers/skeletal-animation'

const NORMAL_SIZE = 3

// The colours (as 0xRRGGBB) the port gives the vertices of the champion's figure in a race preview: the figure's normals
// rotated by its pose and by the guy1 action's frame, lit by the cinema's ambient and directional light.
export const getCinemaFigureColors = (
  archive: JamArchive,
  view: RaceCinemaView
): ReadonlySet<number> => {
  const colors = new Set<number>()
  const cinema = parseCinemaDatabase(archive.readFile('MENUDATA\\SINGRACE\\PST.CDB')).cinemas.find(
    (candidate) => candidate.name.toLowerCase() === view.cinemaName.toLowerCase()
  )
  const ambientLight = cinema?.ambientLights[0]
  const directionalLight = cinema?.directionalLights[0]
  const action =
    cinema === undefined
      ? undefined
      : getActiveCinemaActions(cinema, view.milliseconds).find(
          (candidate) => candidate.instanceName === 'guy1'
        )
  if (
    cinema === undefined ||
    action === undefined ||
    view.partBytes === null ||
    ambientLight === undefined ||
    directionalLight?.direction === null ||
    directionalLight === undefined
  )
    return colors
  const { scene } = loadMenuDriverScene(archive, view.partBytes, 'SINGRACE\\GUY1')
  const mesh = scene.meshes[0]
  const skeleton = scene.skeletons[0]?.skeleton
  const animation = scene.animations[0]?.animation
  if (
    mesh?.normals === null ||
    mesh === undefined ||
    skeleton === undefined ||
    animation === undefined
  )
    return colors
  const state = advanceSkeletonAnimation(
    createSkeletonAnimationState(animation, action.flag),
    animation,
    getCinemaLoopMilliseconds(cinema, view.milliseconds)
  )
  const matrices = getBoneMatrices(
    skeleton,
    getSkeletonPose(getRestPose(skeleton), animation, state)
  )
  const [forwardX, forwardY, forwardZ] = action.forward
  const [upX, upY, upZ] = action.up
  const side = [
    upY * forwardZ - upZ * forwardY,
    upZ * forwardX - upX * forwardZ,
    upX * forwardY - upY * forwardX,
  ] as const
  const direction = directionalLight.direction
  const light = {
    color: [directionalLight.red, directionalLight.green, directionalLight.blue] as LightChannels,
    direction,
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
