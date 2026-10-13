// What the models folder holds: the file of each car (by its upper-case body code) and of each chassis recipe (by its lower-case
// chassis name), relative to the folder.
export type LDrawModelIndex = {
  readonly cars: Readonly<Record<string, string>>
  readonly chassis: Readonly<Record<string, string>>
}

// A model file under the models folder: its path relative to the folder and when it last changed on disk.
export type LDrawModelFile = {
  readonly path: string
  readonly modifiedMilliseconds: number
}
