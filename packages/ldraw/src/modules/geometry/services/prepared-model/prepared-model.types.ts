import type { Group } from 'three'
import { createEnum } from '../../../../shared/types/enum.types.ts'
import type { EnumValues } from '../../../../shared/types/enum.types.ts'
import type { SplitSubModel } from '../ldraw-parse/ldraw-parse.types.ts'

// What a model is drawn as: a part, a wheel (its plastic takes less of the studio, see `applyPlasticLook`), or a body the app's
// splitter takes sub-models (its wheels) out of, those as wheel plastic.
export const PreparedModelKind = createEnum({
  PART: 'part',
  WHEEL: 'wheel',
  BODY: 'body',
})
export type PreparedModelKind = EnumValues<typeof PreparedModelKind>

// A model parsed, merged, made plastic and compiled, shared by every drawing of it: copy it with `instantiateModel`.
export type PreparedModel = {
  readonly model: Group
  readonly subModels: readonly SplitSubModel[]
}

// A drawing's claim on a prepared model. A model nobody holds is kept a while (the menus and the race draw the same cars) and then
// freed; a hold never released keeps it for the page's life (the few parts every race draws).
export type PreparedModelHold = {
  readonly prepared: Promise<PreparedModel>
  readonly release: () => void
}
