import { createMaterialSet, holdPreparedModel, instantiateModel } from '../../../geometry/index.ts'
import type { LDrawDetail } from '../../../library/index.ts'
import { createStudioLights } from '../../../material/index.ts'
import { Group } from 'three'
import type { HeldModelObject } from './model-object.types.ts'

// The model in the active look with its studio, turned from LDraw's y-down axes to three.js's y-up ones.
export const createModelObject = async (
  text: string,
  detail: LDrawDetail
): Promise<HeldModelObject> => {
  const hold = holdPreparedModel(text, detail)
  try {
    const model = instantiateModel((await hold.prepared).model, createMaterialSet())
    const object = new Group()
    object.rotation.x = Math.PI
    object.add(model, createStudioLights())
    return Object.freeze({ object, release: hold.release })
  } catch (error: unknown) {
    hold.release()
    throw error
  }
}
