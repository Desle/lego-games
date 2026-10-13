import type {
  EndedFrame,
  OpenFrame,
  TimerQuery,
  FrameHandle,
  FrameSample,
  GraphicsTotals,
  ParseStatistics,
  PerformanceTraceGraphics,
} from './performance-trace.types.ts'

// The performance trace's init script: it runs in the page before any of the page's scripts (`page.addInitScript`), so it must
// not use anything from outside its own body. It counts the draws and the live objects of every WebGL context of the page, times
// frames on the CPU and, when `EXT_disjoint_timer_query_webgl2` exists, on the GPU, and times the LDraw parse worker's requests.
export const installPerformanceTraceGraphics = () => {
  const POINTS = 0
  const LINES = 1
  const LINE_LOOP = 2
  const LINE_STRIP = 3
  const TRIANGLES = 4
  const QUERY_POLL_MILLISECONDS = 16
  const QUERY_TIMEOUT_MILLISECONDS = 3000
  const ANIMATION_FRAME_TIMEOUT_MILLISECONDS = 60_000
  const NANOSECONDS_PER_MILLISECOND = 1_000_000

  let drawCalls = 0
  let triangles = 0
  let lines = 0
  let points = 0
  let firstDrawAt = 0
  const contextObjects = new Map<WebGL2RenderingContext, Map<string, Set<unknown>>>()
  const timerExtensions = new Map<WebGL2RenderingContext, number | null>()
  const activeQueries = new Set<WebGL2RenderingContext>()

  const getObjects = (context: WebGL2RenderingContext): Map<string, Set<unknown>> => {
    const existing = contextObjects.get(context)
    if (existing !== undefined) return existing
    const created = new Map<string, Set<unknown>>()
    contextObjects.set(context, created)
    return created
  }

  const getLiveCount = (kind: string): number =>
    [...contextObjects].reduce(
      (total, [context, objects]) =>
        context.isContextLost() ? total : total + (objects.get(kind)?.size ?? 0),
      0
    )

  const addPrimitives = (mode: unknown, vertexCount: unknown, instanceCount: unknown) => {
    if (typeof vertexCount !== 'number') return
    const instances = typeof instanceCount === 'number' ? instanceCount : 1
    if (firstDrawAt === 0) firstDrawAt = performance.now()
    drawCalls += 1
    if (mode === POINTS) points += vertexCount * instances
    else if (mode === LINES) lines += Math.floor(vertexCount / 2) * instances
    else if (mode === LINE_LOOP) lines += vertexCount * instances
    else if (mode === LINE_STRIP) lines += Math.max(vertexCount - 1, 0) * instances
    else if (mode === TRIANGLES) triangles += Math.floor(vertexCount / 3) * instances
    else triangles += Math.max(vertexCount - 2, 0) * instances
  }

  const wrapMethod = (
    prototype: object,
    name: string,
    onCall: (context: unknown, argumentList: readonly unknown[], result: unknown) => void
  ) => {
    const original: unknown = Reflect.get(prototype, name)
    if (typeof original !== 'function') return
    Reflect.set(
      prototype,
      name,
      new Proxy(original, {
        apply: (target, thisArgument: unknown, argumentList: unknown[]) => {
          const result: unknown = Reflect.apply(
            target as (...values: unknown[]) => unknown,
            thisArgument,
            argumentList
          )
          onCall(thisArgument, argumentList, result)
          return result
        },
      })
    )
  }

  const getIsContext = (value: unknown): value is WebGL2RenderingContext =>
    value instanceof WebGL2RenderingContext || value instanceof WebGLRenderingContext

  const track = (context: unknown) => {
    if (getIsContext(context)) getObjects(context)
  }

  for (const prototype of [WebGL2RenderingContext.prototype, WebGLRenderingContext.prototype]) {
    wrapMethod(prototype, 'drawArrays', (context, [mode, , count]) => {
      track(context)
      addPrimitives(mode, count, 1)
    })
    wrapMethod(prototype, 'drawElements', (context, [mode, count]) => {
      track(context)
      addPrimitives(mode, count, 1)
    })
    wrapMethod(prototype, 'drawArraysInstanced', (context, [mode, , count, instances]) => {
      track(context)
      addPrimitives(mode, count, instances)
    })
    wrapMethod(prototype, 'drawElementsInstanced', (context, [mode, count, , , instances]) => {
      track(context)
      addPrimitives(mode, count, instances)
    })
    wrapMethod(prototype, 'drawRangeElements', (context, [mode, , , count]) => {
      track(context)
      addPrimitives(mode, count, 1)
    })
    for (const kind of ['Program', 'Texture', 'Buffer', 'VertexArray']) {
      wrapMethod(prototype, `create${kind}`, (context, _argumentList, result) => {
        if (!getIsContext(context) || result === null) return
        const objects = getObjects(context)
        objects.set(kind, (objects.get(kind) ?? new Set()).add(result))
      })
      wrapMethod(prototype, `delete${kind}`, (context, [object]) => {
        if (getIsContext(context)) getObjects(context).get(kind)?.delete(object)
      })
    }
  }

  const getTimerTarget = (context: WebGL2RenderingContext): number | null => {
    if (!timerExtensions.has(context)) {
      const extension: unknown =
        context instanceof WebGL2RenderingContext
          ? context.getExtension('EXT_disjoint_timer_query_webgl2')
          : null
      const target: unknown =
        extension instanceof Object ? Reflect.get(extension, 'TIME_ELAPSED_EXT') : null
      timerExtensions.set(context, typeof target === 'number' ? target : null)
    }
    return timerExtensions.get(context) ?? null
  }

  const getTotals = (): GraphicsTotals =>
    Object.freeze({
      drawCalls,
      triangles,
      lines,
      points,
      programs: getLiveCount('Program'),
      textures: getLiveCount('Texture'),
      buffers: getLiveCount('Buffer'),
      vertexArrays: getLiveCount('VertexArray'),
    })

  // A frame being measured: where the counters stood at its start, and the timer queries it opened.
  const openFrames = new Map<number, OpenFrame>()
  let endedFrames: readonly EndedFrame[] = []
  let nextFrameIndex = 0
  let frameKey = 0

  const beginFrame = (): FrameHandle => {
    const queries = [...contextObjects.keys()].flatMap((context): TimerQuery[] => {
      const target = getTimerTarget(context)
      if (target === null || context.isContextLost() || activeQueries.has(context)) return []
      const query = context.createQuery()
      context.beginQuery(target, query)
      activeQueries.add(context)
      return [[context, query]]
    })
    const index = nextFrameIndex
    nextFrameIndex += 1
    openFrames.set(index, { start: performance.now(), totals: getTotals(), queries })
    return Object.freeze({ index })
  }

  const endFrame = (handle: FrameHandle) => {
    const open = openFrames.get(handle.index)
    if (open === undefined) return
    openFrames.delete(handle.index)
    for (const [context] of open.queries) {
      const target = getTimerTarget(context)
      if (target !== null && !context.isContextLost()) context.endQuery(target)
      activeQueries.delete(context)
    }
    const totals = getTotals()
    endedFrames = [
      ...endedFrames,
      {
        key: frameKey,
        queries: open.queries,
        sample: Object.freeze({
          cpuMilliseconds: performance.now() - open.start,
          gpuMilliseconds: null,
          drawCalls: totals.drawCalls - open.totals.drawCalls,
          triangles: totals.triangles - open.totals.triangles,
          lines: totals.lines - open.totals.lines,
          points: totals.points - open.totals.points,
        }),
      },
    ]
  }

  const wait = (milliseconds: number) =>
    new Promise((resolve) => window.setTimeout(resolve, milliseconds))

  const getIsAnswered = ([context, query]: TimerQuery) =>
    context.isContextLost() ||
    context.getQueryParameter(query, context.QUERY_RESULT_AVAILABLE) === true

  // The GPU milliseconds of a frame: its queries' sum, or null when a query is missing or the GPU was disjoint meanwhile.
  const getGpuMilliseconds = (queries: readonly TimerQuery[]): number | null => {
    if (queries.length === 0) return null
    let nanoseconds = 0
    for (const [context, query] of queries) {
      if (context.isContextLost()) return null
      const extension: unknown = context.getExtension('EXT_disjoint_timer_query_webgl2')
      const disjoint: unknown =
        extension instanceof Object ? Reflect.get(extension, 'GPU_DISJOINT_EXT') : null
      if (typeof disjoint === 'number' && context.getParameter(disjoint) === true) return null
      if (context.getQueryParameter(query, context.QUERY_RESULT_AVAILABLE) !== true) return null
      const result: unknown = context.getQueryParameter(query, context.QUERY_RESULT)
      if (typeof result !== 'number') return null
      nanoseconds += result
      context.deleteQuery(query)
    }
    return nanoseconds / NANOSECONDS_PER_MILLISECOND
  }

  const collectEndedFrames = async () => {
    const start = performance.now()
    while (
      !endedFrames.every((frame) => frame.queries.every(getIsAnswered)) &&
      performance.now() - start < QUERY_TIMEOUT_MILLISECONDS
    ) {
      await wait(QUERY_POLL_MILLISECONDS)
    }
    return endedFrames.map((frame) => ({
      key: frame.key,
      sample: Object.freeze({
        ...frame.sample,
        gpuMilliseconds: getGpuMilliseconds(frame.queries),
      }),
    }))
  }

  const resetFrames = () => {
    endedFrames = []
  }

  // The page's animation frames: each callback is measured as a frame of its own, keyed by the frame's timestamp, and the
  // callbacks of one timestamp are added up.
  let isRecordingAnimationFrames = false
  const animationTimestamps = new Set<number>()
  const runAnimationCallback = (callback: unknown, time: number) => {
    if (typeof callback !== 'function') return
    if (!isRecordingAnimationFrames) {
      Reflect.apply(callback, undefined, [time])
      return
    }
    animationTimestamps.add(time)
    frameKey = time
    const handle = beginFrame()
    try {
      Reflect.apply(callback, undefined, [time])
    } finally {
      endFrame(handle)
    }
  }
  const originalRequestAnimationFrame: unknown = Reflect.get(window, 'requestAnimationFrame')
  if (typeof originalRequestAnimationFrame === 'function') {
    Reflect.set(
      window,
      'requestAnimationFrame',
      new Proxy(originalRequestAnimationFrame, {
        apply: (target, thisArgument: unknown, [callback]: unknown[]) =>
          Reflect.apply(target as (...values: unknown[]) => unknown, thisArgument, [
            (time: number) => runAnimationCallback(callback, time),
          ]),
      })
    )
  }

  const recordAnimationFrames = async (count: number): Promise<readonly FrameSample[]> => {
    resetFrames()
    animationTimestamps.clear()
    isRecordingAnimationFrames = true
    const start = performance.now()
    while (
      animationTimestamps.size <= count &&
      performance.now() - start < ANIMATION_FRAME_TIMEOUT_MILLISECONDS
    ) {
      await wait(QUERY_POLL_MILLISECONDS)
    }
    isRecordingAnimationFrames = false
    const frames = await collectEndedFrames()
    const keys = [...animationTimestamps].slice(0, count)
    return keys.map((key) => {
      const parts = frames.filter((frame) => frame.key === key).map((frame) => frame.sample)
      const gpuParts = parts.flatMap((part) =>
        part.gpuMilliseconds === null ? [] : [part.gpuMilliseconds]
      )
      return Object.freeze({
        cpuMilliseconds: parts.reduce((total, part) => total + part.cpuMilliseconds, 0),
        gpuMilliseconds:
          gpuParts.length > 0 && gpuParts.length === parts.length
            ? gpuParts.reduce((total, part) => total + part, 0)
            : null,
        drawCalls: parts.reduce((total, part) => total + part.drawCalls, 0),
        triangles: parts.reduce((total, part) => total + part.triangles, 0),
        lines: parts.reduce((total, part) => total + part.lines, 0),
        points: parts.reduce((total, part) => total + part.points, 0),
      })
    })
  }

  // The LDraw parse worker's requests (`{ id, request }`) and its answers (`{ id, … }`).
  let requestCount = 0
  let requestMilliseconds = 0
  let busyMilliseconds = 0
  let busySince = 0
  let lastSettledAt = 0
  const pendingRequests = new Map<Worker, Map<number, number>>()
  const getPendingCount = () =>
    [...pendingRequests.values()].reduce((total, pending) => total + pending.size, 0)
  const onWorkerMessage = (worker: Worker, data: unknown) => {
    const id: unknown = data instanceof Object ? Reflect.get(data, 'id') : null
    const pending = pendingRequests.get(worker)
    const sentAt = typeof id === 'number' ? pending?.get(id) : undefined
    if (sentAt === undefined || typeof id !== 'number') return
    const now = performance.now()
    pending?.delete(id)
    requestMilliseconds += now - sentAt
    if (getPendingCount() > 0) return
    busyMilliseconds += now - busySince
    lastSettledAt = now
  }
  wrapMethod(Worker.prototype, 'postMessage', (worker, [message]) => {
    if (!(worker instanceof Worker) || !(message instanceof Object)) return
    const id: unknown = Reflect.get(message, 'id')
    if (typeof id !== 'number' || !('request' in message)) return
    if (!pendingRequests.has(worker)) {
      pendingRequests.set(worker, new Map())
      worker.addEventListener('message', (event: MessageEvent<unknown>) =>
        onWorkerMessage(worker, event.data)
      )
    }
    const now = performance.now()
    if (getPendingCount() === 0) busySince = now
    requestCount += 1
    pendingRequests.get(worker)?.set(id, now)
  })
  const getParseStatistics = (): ParseStatistics =>
    Object.freeze({
      requestCount,
      requestMilliseconds,
      busyMilliseconds,
      pendingCount: getPendingCount(),
      lastSettledAt,
    })

  const graphics: PerformanceTraceGraphics = Object.freeze({
    getTotals,
    getParseStatistics,
    beginFrame: () => {
      frameKey = -1
      return beginFrame()
    },
    endFrame,
    collectFrames: async () => (await collectEndedFrames()).map((frame) => frame.sample),
    resetFrames,
    recordAnimationFrames,
    getFirstDrawnFrameAt: () => firstDrawAt,
  })
  Reflect.set(window, 'performanceTraceGraphics', graphics)
}
