// Defined here, not imported: the foundation is a private dev dependency, so production installs
// (`pnpm install --prod`, container images) don't have it.
export type EnumValues<EnumObject> = EnumObject[keyof EnumObject]

export const createEnum = <const EnumObject extends Readonly<Record<string, string>>>(
  values: EnumObject
): Readonly<EnumObject> => Object.freeze(values)
