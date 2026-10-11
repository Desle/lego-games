const MILLISECONDS_PER_HOUR = 3_600_000
const MILLISECONDS_PER_TEN_MINUTES = 600_000
// 0x00425e90 measures the time column with these two: zero, and 59:59:88 (0x36ee08).
export const LONGEST_TIME_MILLISECONDS = 0x36ee08

const getDigit = (value: number): string => String(value % 10)

// FUN_004246d0: a time as `M:SS:CC` (minutes, seconds, hundredths; the separators are colons), `MM:SS:CC` from ten
// minutes on, taken modulo an hour.
export const formatHudTime = (milliseconds: number): string => {
  const wholeMilliseconds = Math.trunc(milliseconds) % MILLISECONDS_PER_HOUR
  const hundredths = Math.floor(wholeMilliseconds / 10)
  const totalSeconds = Math.floor(hundredths / 100)
  const seconds = totalSeconds % 60
  const minutes = Math.floor(totalSeconds / 60)
  const hundredthsText = `${getDigit(Math.floor(hundredths / 10))}${getDigit(hundredths)}`
  const secondsText = `${getDigit(Math.floor(seconds / 10))}${getDigit(seconds)}`
  const minutesText =
    wholeMilliseconds < MILLISECONDS_PER_TEN_MINUTES
      ? getDigit(minutes)
      : `${getDigit(Math.floor(minutes / 10))}${getDigit(minutes)}`
  return `${minutesText}:${secondsText}:${hundredthsText}`
}
