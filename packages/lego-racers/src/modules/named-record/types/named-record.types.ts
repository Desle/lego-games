// The five database files the exe reads with the same frame: `0x27 [ count ] { (0x27 name { keywords }) * count }`.
export type NamedRecordList<Record> = {
  readonly records: readonly Record[]
  readonly readByteCount: number
}
