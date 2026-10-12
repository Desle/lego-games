export type ConstantLiteral = {
  readonly path: string
  readonly line: number
  /** Names of the enclosing declarations, outermost first, so the key survives line shifts. */
  readonly scope: string
  readonly literal: string
}

export type TracedConstantsBaselineEntry = {
  readonly path: string
  readonly scope: string
  readonly literal: string
  readonly count: number
}

export type TracedConstantsBaseline = {
  readonly entries: readonly TracedConstantsBaselineEntry[]
}

export type TracedConstantsProblem = {
  readonly path: string
  readonly line: number | null
  readonly message: string
}
