// A hazard class was handed a definition of another class: the keyword picks the class, so this cannot happen
// unless the runtime table and the parser disagree.
export class HazardDefinitionError extends Error {
  readonly keyword: number

  constructor(keyword: number, expected: number) {
    super(
      `Hazard 0x${keyword.toString(16)} was given to the class of hazard 0x${expected.toString(16)}`
    )
    this.name = 'HazardDefinitionError'
    this.keyword = keyword
  }
}
