// What the models folder holds: the file of each car (by its upper-case body code) and of each chassis recipe (by its lower-case
// chassis name), relative to the folder.
export type LDrawModelIndex = {
  readonly cars: Readonly<Record<string, string>>
  readonly chassis: Readonly<Record<string, string>>
}
