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

export type EmulatorCall = {
  readonly address: number
  readonly convention: EmulatorConvention
  readonly precision: EmulatorPrecision
  readonly arguments: readonly EmulatorArgument[]
  readonly buffers: readonly EmulatorBuffer[]
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
