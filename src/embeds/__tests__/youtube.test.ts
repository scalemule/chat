import { describe, expect, it } from 'vitest';

import { extractYouTubeIds } from '../youtube';

describe('extractYouTubeIds', () => {
  it('returns an empty array for empty input', () => {
    expect(extractYouTubeIds('')).toEqual([]);
  });

  it('detects standard watch URLs', () => {
    expect(
      extractYouTubeIds('check https://www.youtube.com/watch?v=dQw4w9WgXcQ here'),
    ).toEqual(['dQw4w9WgXcQ']);
  });

  it('detects youtu.be short links', () => {
    expect(extractYouTubeIds('see https://youtu.be/dQw4w9WgXcQ')).toEqual([
      'dQw4w9WgXcQ',
    ]);
  });

  it('detects /embed/ links', () => {
    expect(
      extractYouTubeIds('https://www.youtube.com/embed/dQw4w9WgXcQ'),
    ).toEqual(['dQw4w9WgXcQ']);
  });

  it('detects /shorts/ links', () => {
    expect(
      extractYouTubeIds('https://www.youtube.com/shorts/dQw4w9WgXcQ'),
    ).toEqual(['dQw4w9WgXcQ']);
  });

  it('de-duplicates the same id when it appears multiple times', () => {
    expect(
      extractYouTubeIds(
        'https://youtu.be/dQw4w9WgXcQ and https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      ),
    ).toEqual(['dQw4w9WgXcQ']);
  });

  it('preserves order of first appearance for distinct ids', () => {
    expect(
      extractYouTubeIds(
        'https://youtu.be/aaaaaaaaaaa then https://youtu.be/bbbbbbbbbbb',
      ),
    ).toEqual(['aaaaaaaaaaa', 'bbbbbbbbbbb']);
  });

  it('strips HTML tags so URLs inside iframe src are not double-counted', () => {
    const html = `
      <iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ"></iframe>
      explanation: https://youtu.be/dQw4w9WgXcQ
    `;
    expect(extractYouTubeIds(html)).toEqual(['dQw4w9WgXcQ']);
  });

  it('does not match non-YouTube URLs', () => {
    expect(extractYouTubeIds('https://example.com/watch?v=xxxxxxxxxxx')).toEqual(
      [],
    );
  });

  it('is SSR-safe — no DOM access', () => {
    // @ts-expect-error window is undefined in node test env
    expect(typeof window).toBe('undefined');
    expect(extractYouTubeIds('https://youtu.be/abcdefghijk')).toEqual([
      'abcdefghijk',
    ]);
  });
});
