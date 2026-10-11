export type Vector3 = readonly [number, number, number]

// The three ids a block's `0x27 0x36 / 0x34 / 0x37 integer` lines give (event +0x08, +0x0c, +0x10): what the event
// announces when it enters its states 2, 3 and 4 (0x0045edd0).
export type EventPhaseSignals = {
  readonly first: number
  readonly second: number
  readonly third: number
}

export type EventBlockHeader = {
  readonly identifier: number
  // The block was opened with 0x3c before its curly.
  readonly isBraced: boolean
}

// What a block holds besides its header.
export type EventBody<Event extends EventBlockHeader> = Omit<Event, keyof EventBlockHeader>

export type IntegerQuadruple = readonly [number, number, number, number]

export type EventSignalFields = { readonly phaseSignals: EventPhaseSignals }

export type EventBase = EventBlockHeader & {
  readonly phaseSignals: EventPhaseSignals
}

export type ObjectReference = {
  readonly name: string
  // 0x41 was in the block: the name is looked up in the second world's tables.
  readonly isFromSecondWorld: boolean
}

// 0x0045f220 (array +0x5c): no phase signals.
export type Event2A = EventBlockHeader & {
  readonly keyword2cInteger: number
  readonly isKeyword2dSet: boolean
  readonly keyword2eInteger: number
  readonly keyword2fFloat: number
  readonly keyword30Float: number
  readonly keyword31Float: number
  readonly keyword32Float: number
  readonly objectName: string | null
  readonly isKeyword3aSet: boolean
  readonly position: Vector3
  readonly isKeyword3fSet: boolean
  readonly chance: number
  readonly keyword54Integer: number
}

export type Event28 = EventBase & {
  readonly isKeyword2dSet: boolean
  readonly objectReference: ObjectReference | null
  readonly isKeyword41Set: boolean
  readonly keyword34Integer: number
  readonly keyword35Integer: number
  readonly keyword36Integer: number
  readonly keyword37Integer: number
  readonly isKeyword3aSet: boolean
  readonly isKeyword3fSet: boolean
}

export type Event29 = EventBase & {
  readonly isKeyword2dSet: boolean
  readonly objectName: string | null
  readonly objectShort: number
  readonly keyword34Integer: number
  readonly keyword35Integer: number
  readonly keyword38Integer: number | null
  readonly isKeyword3aSet: boolean
  readonly isKeyword3fSet: boolean
}

export type Event3D = EventBase & {
  readonly objectReference: ObjectReference | null
  readonly isKeyword41Set: boolean
  readonly isKeyword3aSet: boolean
  readonly position: Vector3
  readonly secondName: string
  readonly orientation: readonly [number, number, number, number, number, number]
  readonly isKeyword3fSet: boolean
  readonly keyword54Integer: number
}

export type Event42 = EventBase & {
  readonly name: string
  readonly keyword44Integer: number
  readonly flags: number
}

export type Event4B = EventBase & {
  readonly keyword49Integer: number
  readonly keyword4cInteger: number
}

export type Event4D = EventBase & {
  readonly objectName: string | null
  readonly isKeyword3aSet: boolean
  readonly isKeyword50Set: boolean
  readonly keyword4eIntegers: IntegerQuadruple
  readonly keyword4fIntegers: IntegerQuadruple
}

// 0x00461990: the zone a block names (token 0x36 is 0, 0x37 is 2, none is 1).
export type Event51 = EventBase & {
  readonly zone: number
}

export type Event52 = EventBase & {
  readonly objectReference: ObjectReference | null
  readonly secondObjectName: string | null
  readonly keyword54Integer: number
}

export type Event53 = EventBase & {
  readonly objectReference: ObjectReference | null
  readonly isKeyword3aSet: boolean
  readonly isKeyword41Set: boolean
  readonly isKeyword46Set: boolean
}

export type Event55 = EventBase & {
  readonly position: Vector3
}

export type Event59 = EventBase & {
  readonly position: Vector3
  readonly keyword4cInteger: number
  readonly keyword5aInteger: number
}

// 0x00460320: `identifier { 0x39 integer }` pairs.
export type EventLink = {
  readonly identifier: number
  readonly linkedIdentifier: number
}

export type EventSet = {
  readonly events2A: readonly Event2A[]
  readonly events28: readonly Event28[]
  readonly events29: readonly Event29[]
  readonly events3D: readonly Event3D[]
  readonly events42: readonly Event42[]
  readonly events4B: readonly Event4B[]
  readonly events4D: readonly Event4D[]
  readonly events51: readonly Event51[]
  readonly events52: readonly Event52[]
  readonly events53: readonly Event53[]
  readonly events55: readonly Event55[]
  readonly events59: readonly Event59[]
  readonly links: readonly EventLink[]
  readonly readByteCount: number
}
