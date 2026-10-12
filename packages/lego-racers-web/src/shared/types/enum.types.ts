export type EnumValues<EnumObject> = EnumObject[keyof EnumObject]

export const createEnum = <const EnumObject extends Readonly<Record<string, string>>>(
  values: EnumObject
): Readonly<EnumObject> => Object.freeze(values)
