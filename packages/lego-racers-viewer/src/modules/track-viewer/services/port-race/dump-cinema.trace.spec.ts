import { writeFileSync } from 'node:fs'
import { readOriginalFrontEnd } from '@lego-games/lego-racers/presentation-trace'

const KEYS: readonly (readonly [number, number])[] = [
  [250, 208],
  [270, 28],
  [290, 205],
]
const FRAMES = [420, 440, 441, 442, 460, 480]

describe('dump', () => {
  it('dumps', async () => {
    const original = await readOriginalFrontEnd({
      name: 'dump snow',
      frames: Array.from({ length: 481 }, (_, frame) => {
        const key = KEYS.find(([keyFrame]) => keyFrame === frame)
        return { milliseconds: 33, scanCodes: key === undefined ? [] : [key[1]] }
      }),
      recordFrames: FRAMES,
      isRenderRecorded: true,
    })
    const lines = original.renderFrames.flatMap((frame) =>
      frame.draws.flatMap((draw, index) => {
        if (draw.modelMatrix.length === 0) return []
        const colors = [...new Set(draw.vertices.map((vertex) => vertex.diffuse.toString(16)))]
        const xs = draw.vertices.map((vertex) => vertex.x)
        const ys = draw.vertices.map((vertex) => vertex.y)
        const render = frame.states[draw.stateIndex]?.render
        return [
          `${String(frame.frame)} #${String(index)} tex=${String(draw.textureHash?.slice(0, 6))} n=${String(draw.vertices.length)} idx=${String(draw.indices?.length)} x=${Math.min(...xs).toFixed(0)}..${Math.max(...xs).toFixed(0)} y=${Math.min(...ys).toFixed(0)}..${Math.max(...ys).toFixed(0)} ${colors.slice(0, 3).join(',')} blend=${String(render?.['27'])} src=${String(render?.['19'])} dst=${String(render?.['20'])} z=${String(render?.['7'])}`,
        ]
      })
    )
    writeFileSync(
      '/private/tmp/claude-501/-Users-desle-Vibespace-projects-lego-games/baee6b02-5a40-431c-a08d-c5cbd67b862e/scratchpad/dump-cinema.txt',
      lines.join('\n')
    )
    expect(lines.length).toBeGreaterThan(0)
  })
})
