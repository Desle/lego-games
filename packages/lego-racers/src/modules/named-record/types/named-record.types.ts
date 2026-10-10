// The five database files the exe reads with the same frame: `0x27 [ count ] { (0x27 name { keywords }) * count }`.
export type NamedRecordList<Entry> = {
  readonly records: readonly Entry[]
  readonly readByteCount: number
}

// A record the name table can find: it carries its name.
export type NamedRecord = { readonly name: string }
