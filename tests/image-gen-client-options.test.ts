import { describe, it, expect } from 'vitest';
import { buildOpenAIClientOptions } from '../lib/image-gen';

describe('OpenAI compatible image client options', () => {
  it('disables SDK retries so one image click cannot create multiple paid tasks', () => {
    const options = buildOpenAIClientOptions({
      apiKey: 'test-key',
      baseUrl: 'https://api.geeknow.ai/v1',
      timeoutMs: 600_000,
    });

    expect(options.maxRetries).toBe(0);
    expect(options.timeout).toBe(600_000);
    expect(options.baseURL).toBe('https://api.geeknow.ai/v1');
  });

  it('uses default values when not provided', () => {
    const options = buildOpenAIClientOptions({
      apiKey: 'test-key',
      timeoutMs: 30000,
    });

    expect(options.maxRetries).toBe(0);
    expect(options.timeout).toBe(30000);
    expect(options.baseURL).toBeUndefined();
  });

  it('sets API key correctly', () => {
    const options = buildOpenAIClientOptions({
      apiKey: 'my-secret-key',
      timeoutMs: 10000,
    });

    expect(options.apiKey).toBe('my-secret-key');
  });
});
