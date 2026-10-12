import { Vector3 } from 'three'
import type { Group } from 'three'
import { LDrawDetail } from '../ldraw-library/ldraw-library-loader.types.ts'
import { getIsStudLogoShown } from '../ldraw-library/stud-logos.ts'
import { requestParsedModel } from '../ldraw-worker/ldraw-parse-client.ts'
import { createPlasticModel, getIsOcclusionBaked } from './detailed-model.ts'
import { DetailSwitch } from './detail-switch.ts'
import { createOcclusionVolume } from './ldraw-occlusion.ts'
import { precompileShaders } from './shader-precompiler.ts'
import type { BodyWheel, DetailedBody } from './detailed-body.types.ts'

// A car's body model drawn in two details (plain studs first, logo studs when the camera comes near, one shown by the distance). The
// body is not shared between cars: the wheels and any minifigure are taken out of each parsed model, and `onWheels` is told of the
// wheels (their parts, in the model's frame) of each detail.
export const createDetailedBody = (
  text: string,
  onWheels: ((wheels: readonly BodyWheel[], detail: LDrawDetail) => void) | null
): DetailedBody => {
  const object = new DetailSwitch()
  const prepareLevel = async (detail: LDrawDetail): Promise<Group> => {
    const result = await requestParsedModel({
      text,
      detail,
      isOcclusionBaked: getIsOcclusionBaked(),
      isTakingWheels: onWheels !== null,
    })
    const volume = result.grid === null ? null : createOcclusionVolume(result.grid)
    const body = createPlasticModel(result.body, volume)
    onWheels?.(
      result.wheels.map((wheel) => ({
        unit: createPlasticModel(wheel.model, volume, true),
        centre: new Vector3(...wheel.centre),
      })),
      detail
    )
    await precompileShaders(body)
    return body
  }
  if (getIsStudLogoShown()) object.setHighLoader(() => prepareLevel(LDrawDetail.HIGH))
  const shown = prepareLevel(LDrawDetail.LOW).then((low) => object.setLow(low))
  const refined = () => shown.then(() => object.requestHigh())
  return { object, shown, refined }
}
