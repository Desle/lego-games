import type { ReplayFrame } from '@lego-games/lego-racers/session-recording'

// The recording of the race that runs; null where nothing is recorded (the high-definition view, a ghost race).
export type RaceRecording = {
  readonly addFrame: (frame: ReplayFrame) => void
  // Stores the recording once (a later call does nothing); an empty one is dropped.
  readonly finish: () => Promise<void>
}

// Hands a finished recording to the dev server's inbox.
export type InboxPoster = (fileName: string, text: string) => Promise<void>
