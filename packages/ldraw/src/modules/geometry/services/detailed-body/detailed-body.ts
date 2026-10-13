import { Vector3 } from 'three'
import type { Group } from 'three'
import { getIsStudLogoShown, LDrawDetail } from '../../../library/index.ts'
import { getLibraryUrl, requestParsedModel } from '../ldraw-parse/ldraw-parse-client.ts'
import { createPlasticModel, getIsOcclusionBaked } from '../detailed-model/detailed-model.ts'
import { DetailSwitch } from '../detail-switch/detail-switch.ts'
import { createOcclusionVolume, precompileShaders } from '../../../material/index.ts'
import type { SplitSubModel } from '../ldraw-parse/ldraw-parse.types.ts'
import type { DetailedBody } from './detailed-body.types.ts'

// A vehicle's body model drawn in two details (plain studs first, logo studs when the camera comes near, one shown by the distance).
// The body is not shared between vehicles: the app's splitter takes its sub-models (the wheels) out of each parsed model, and
// `onSubModels` is told of them (their parts, in the model's frame, as wheel plastic) for each detail.
export const createDetailedBody = (
  text: string,
  onSubModels: ((subModels: readonly SplitSubModel[], detail: LDrawDetail) => void) | null
): DetailedBody => {
  const object = new DetailSwitch()
  const prepareLevel = async (detail: LDrawDetail): Promise<Group> => {
    const result = await requestParsedModel({
      text,
      detail,
      libraryUrl: getLibraryUrl(),
      isOcclusionBaked: getIsOcclusionBaked(),
      isSplittingSubModels: onSubModels !== null,
    })
    const volume = result.grid === null ? null : createOcclusionVolume(result.grid)
    const body = createPlasticModel(result.body, volume)
    onSubModels?.(
      result.subModels.map((subModel) => ({
        unit: createPlasticModel(subModel.model, volume, true),
        centre: new Vector3(...subModel.centre),
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
