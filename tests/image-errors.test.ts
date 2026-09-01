import { describe, it, expect } from 'vitest';
import { classifyImageError } from '../lib/image-errors';

describe('image error classification', () => {
  it('explains connection failures from reference-image edit requests', () => {
    const classified = classifyImageError('images.edit failed: Connection error.');

    expect(classified.kind).toBe('reference-upload');
    expect(classified.status).toBe(502);
    expect(classified.message).toMatch(/参考图/);
    expect(classified.message).toMatch(/后台/);
  });

  it('classifies API key errors', () => {
    const classified = classifyImageError('Invalid API key');

    expect(classified.kind).toBe('auth');
    expect(classified.status).toBe(401);
  });

  it('classifies rate limit errors', () => {
    const classified = classifyImageError('Rate limit exceeded');

    expect(classified.kind).toBe('rate-limit');
    expect(classified.status).toBe(429);
  });

  it('classifies timeout errors', () => {
    const classified = classifyImageError('Image generation timeout');

    expect(classified.kind).toBe('timeout');
    expect(classified.status).toBe(504);
  });

  it('classifies unknown errors as generic', () => {
    const classified = classifyImageError('Something went wrong');

    expect(classified.kind).toBe('unknown');
    expect(classified.status).toBe(502);
  });
});
