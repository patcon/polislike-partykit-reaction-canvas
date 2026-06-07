export interface VttCue {
  startTime: string
  text: string
}

export function parseVttCues(vtt: string): VttCue[] {
  const cues: VttCue[] = []
  const lines = vtt.split('\n')
  let i = 0
  while (i < lines.length) {
    const line = lines[i].trim()
    if (line.includes('-->')) {
      const startTime = line.split('-->')[0].trim()
      const textLines: string[] = []
      i++
      while (i < lines.length && lines[i].trim() !== '') {
        textLines.push(lines[i].trim())
        i++
      }
      const text = textLines.join(' ').trim()
      if (text) cues.push({ startTime, text })
    } else {
      i++
    }
  }
  return cues
}

export function computeChunks(text: string, windowSize: number, overlapPct: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return []
  const step = Math.max(1, Math.round(windowSize * (1 - overlapPct / 100)))
  const chunks: string[] = []
  for (let cursor = Math.min(windowSize - 1, words.length - 1); cursor < words.length; cursor += step) {
    const windowStart = Math.max(0, cursor - windowSize + 1)
    chunks.push(words.slice(windowStart, windowStart + windowSize).join(' '))
  }
  return chunks
}

export function getTimestampForWordIndex(wordIndex: number, cues: VttCue[]): string | undefined {
  if (cues.length === 0) return undefined
  let cumulative = 0
  for (const cue of cues) {
    const wordCount = cue.text.trim().split(/\s+/).filter(Boolean).length
    if (wordIndex < cumulative + wordCount) return cue.startTime
    cumulative += wordCount
  }
  return cues[cues.length - 1].startTime
}
