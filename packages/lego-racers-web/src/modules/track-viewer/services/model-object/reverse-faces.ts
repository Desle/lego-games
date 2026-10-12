import type { ModelScene, SceneDrawBatch } from '@lego-games/lego-racers/scene'

const CORNERS_PER_TRIANGLE = 3

const swapSecondAndThirdCorners = <Values extends Uint8Array | Uint32Array>(
  values: Values
): Values => {
  const swapped = values.slice() as Values
  for (
    let corner = 0;
    corner + CORNERS_PER_TRIANGLE <= values.length;
    corner += CORNERS_PER_TRIANGLE
  ) {
    swapped[corner + 1] = values[corner + 2] ?? 0
    swapped[corner + 2] = values[corner + 1] ?? 0
  }
  return swapped
}

const getReversedBatch = (batch: SceneDrawBatch): SceneDrawBatch =>
  Object.freeze({
    ...batch,
    vertexIndices: swapSecondAndThirdCorners(batch.vertexIndices),
    transformIndices: swapSecondAndThirdCorners(batch.transformIndices),
  })

// The same model with every triangle turned the other way round: what the engine's second pass over a double-sided
// figure draws (GolDP.dll slot 0xa4, chosen by figure flag 0x4 in 0x00411560).
export const getReversedModel = (model: ModelScene): ModelScene =>
  Object.freeze({
    ...model,
    scene: Object.freeze({
      ...model.scene,
      meshes: Object.freeze(
        model.scene.meshes.map((mesh) =>
          Object.freeze({
            ...mesh,
            drawBatches: Object.freeze(mesh.drawBatches.map(getReversedBatch)),
          })
        )
      ),
    }),
  })
