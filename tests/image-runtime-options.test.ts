import { describe, it, expect } from 'vitest';
import {
  normalizeImageReferenceMode,
  normalizeImageTimeoutMs,
  selectReferenceImagesForMode,
} from '../lib/image-runtime-options';

describe('image runtime options', () => {
  it('can disable reference images without changing the prompt/model', () => {
    const refs = ['data:image/png;base64,a', 'data:image/png;base64,b'];

    expect(selectReferenceImagesForMode(refs, 'off')).toEqual([]);
    expect(selectReferenceImagesForMode(refs, 'auto')).toEqual(refs);
    expect(normalizeImageReferenceMode('off')).toBe('off');
  });

  it('clamps image timeout between one and ten minutes', () => {
    expect(normalizeImageTimeoutMs(30_000)).toBe(60_000);
    expect(normalizeImageTimeoutMs(180_000)).toBe(180_000);
    expect(normalizeImageTimeoutMs(900_000)).toBe(600_000);
  });

  it('normalizes reference mode', () => {
    expect(normalizeImageReferenceMode('auto')).toBe('auto');
    expect(normalizeImageReferenceMode('invalid')).toBe('auto');
  });
});
