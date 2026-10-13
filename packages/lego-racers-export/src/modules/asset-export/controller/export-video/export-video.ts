import { existsSync, mkdirSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { AssetType } from '../../types/asset-type/asset-type.ts'
import type { ExportReport, OutputWriter } from '../../types/export.types.ts'
import { getBaseName } from '../../services/export-paths/export-paths.ts'
import { getIsFfmpegAvailable, runFfmpeg } from '../../services/ffmpeg/ffmpeg.ts'

const VIDEO_DIRECTORY = 'video'
const FRAME_PATTERN = '%05d.png'

// Every AVI of the game folder (Indeo 5) as numbered PNG frames, a WAV of its sound and a lossless FFV1 mkv, all
// through ffmpeg.
export const exportVideo = (gameDirectory: string, writer: OutputWriter): ExportReport => {
  if (!getIsFfmpegAvailable()) {
    return Object.freeze({
      label: 'video',
      writtenCount: 0,
      failures: [],
      skipMessage:
        'ffmpeg was not found on the PATH, so the videos were skipped (install ffmpeg and run again)',
    })
  }
  const failures: string[] = []
  let writtenCount = 0
  const names = readdirSync(gameDirectory).filter((candidate) => /\.avi$/i.test(candidate))
  for (const name of names) {
    const baseName = getBaseName(name)
    const folder = `${VIDEO_DIRECTORY}/${baseName}`
    const input = join(gameDirectory, name)
    mkdirSync(writer.getAbsolutePath(`${folder}/frames`), { recursive: true })
    const frameError = runFfmpeg([
      '-i',
      input,
      '-fps_mode',
      'passthrough',
      writer.getAbsolutePath(`${folder}/frames/${FRAME_PATTERN}`),
    ])
    if (frameError !== null) failures.push(`${name} frames: ${frameError}`)
    for (const frame of readdirSync(writer.getAbsolutePath(`${folder}/frames`)).sort()) {
      writer.recordFile(`${folder}/frames/${frame}`, AssetType.VIDEO_FRAME, name)
      writtenCount++
    }
    const audioFile = `${folder}/${baseName}.wav`
    const audioError = runFfmpeg([
      '-i',
      input,
      '-vn',
      '-c:a',
      'pcm_s16le',
      writer.getAbsolutePath(audioFile),
    ])
    if (audioError === null && existsSync(writer.getAbsolutePath(audioFile))) {
      writer.recordFile(audioFile, AssetType.VIDEO_AUDIO, name)
      writtenCount++
    } else {
      failures.push(`${name} audio: ${audioError ?? 'no audio stream'}`)
    }
    const videoFile = `${folder}/${baseName}.mkv`
    const videoError = runFfmpeg([
      '-i',
      input,
      '-c:v',
      'ffv1',
      '-c:a',
      'pcm_s16le',
      writer.getAbsolutePath(videoFile),
    ])
    if (videoError === null) {
      writer.recordFile(videoFile, AssetType.VIDEO, name)
      writtenCount++
    } else {
      failures.push(`${name} mkv: ${videoError}`)
    }
  }
  return Object.freeze({ label: 'video', writtenCount, failures, skipMessage: null })
}
