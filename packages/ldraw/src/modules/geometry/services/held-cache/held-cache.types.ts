export type HeldValue<Value> = {
  readonly value: Promise<Value>
  readonly release: () => void
}

export type HeldCache<Value> = {
  readonly hold: (key: string, create: () => Promise<Value>) => HeldValue<Value>
  readonly getSize: () => number
}
