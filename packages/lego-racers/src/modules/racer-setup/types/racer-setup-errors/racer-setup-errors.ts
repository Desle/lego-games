// 0x004119a0 answers 0 for a name the table does not hold, and 0x0043b480 then reads through that null pointer.
export class UnknownRacerRecordError extends Error {
  readonly databaseName: string
  readonly recordName: string

  constructor(databaseName: string, recordName: string) {
    super(`The ${databaseName} database has no record ${recordName}`)
    this.name = 'UnknownRacerRecordError'
    this.databaseName = databaseName
    this.recordName = recordName
  }
}
