export function extractPlainText(vtt: string): string {
  return vtt
    .split('\n')
    .filter(line =>
      !line.startsWith('WEBVTT') &&
      !/^\S+\s-->\s\S+/.test(line) &&
      line.trim() !== ''
    )
    .join(' ')
    .trim();
}
