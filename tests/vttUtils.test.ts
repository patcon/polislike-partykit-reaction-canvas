import { describe, it, expect } from 'vitest';
import { extractPlainText } from '../app/utils/vttUtils';

describe('extractPlainText', () => {
  it('strips the WEBVTT header, cue timings and blank lines', () => {
    const vtt = [
      'WEBVTT',
      '',
      '00:00:01.000 --> 00:00:04.000',
      'Hello there',
      '',
      '00:00:04.000 --> 00:00:06.000',
      'General Kenobi',
    ].join('\n');
    expect(extractPlainText(vtt)).toBe('Hello there General Kenobi');
  });

  it('returns an empty string for a header-only file', () => {
    expect(extractPlainText('WEBVTT\n\n')).toBe('');
  });

  it('returns an empty string for empty input', () => {
    expect(extractPlainText('')).toBe('');
  });

  it('keeps caption lines that are plain text', () => {
    const vtt = ['WEBVTT', '', '00:00:00.000 --> 00:00:02.000', 'Just one line'].join('\n');
    expect(extractPlainText(vtt)).toBe('Just one line');
  });
});
