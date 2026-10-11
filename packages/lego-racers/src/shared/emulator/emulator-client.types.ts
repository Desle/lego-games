export type EmulatorPrecision = 'single' | 'double'

export type EmulatorConvention = 'cdecl' | 'stdcall' | 'thiscall' | 'fastcall'

// A scratch-heap buffer: filled from `words` (uint32 values), or `size` zeroed bytes. `isRead` returns it after the call.
export type EmulatorBuffer = {
  readonly name: string
  readonly words?: readonly EmulatorArgument[]
  readonly size?: number
  readonly isRead: boolean
}

export type EmulatorBufferReference = {
  readonly buffer: string
  readonly offset?: number
}

export type EmulatorArgument = number | EmulatorBufferReference

// Bytes written to the loaded images before the call; reads return words of image memory after it.
export type EmulatorPatch = {
  readonly address: number
  readonly bytes: readonly number[]
}

export type EmulatorRead = {
  readonly name: string
  readonly address: number
  readonly count: number
}

export type EmulatorCall = {
  readonly address: number
  readonly convention: EmulatorConvention
  readonly precision: EmulatorPrecision
  readonly arguments: readonly EmulatorArgument[]
  readonly buffers: readonly EmulatorBuffer[]
  readonly patches?: readonly EmulatorPatch[]
  readonly reads?: readonly EmulatorRead[]
}

export type EmulatorCallResult = {
  readonly eax: number
  readonly fpuStackDepth: number
  readonly st0: { readonly mantissa: string; readonly signExponent: string }
  readonly buffers: Readonly<Record<string, readonly number[]>>
}

export type EmulatorSession = {
  readonly callBatch: (calls: readonly EmulatorCall[]) => Promise<readonly EmulatorCallResult[]>
  readonly close: () => Promise<void>
}

export type BridgeResponse = {
  readonly id: number
  readonly error?: string
  readonly results?: readonly EmulatorCallResult[]
}
