import { describe, it, expect } from 'vitest';
import {
  enqueueImageGenerationJob,
  getImageGenerationJob,
} from '../lib/image-generation-jobs';

describe('image generation jobs', () => {
  it('returns pending immediately and stores the completed image later', async () => {
    const job = enqueueImageGenerationJob(async () => ({
      imageUrl: 'data:image/png;base64,abc123',
    }));

    expect(job.status).toBe('pending');

    await job.done;

    const stored = getImageGenerationJob(job.id);
    expect(stored?.status).toBe('success');
    expect(stored?.imageUrl).toBe('data:image/png;base64,abc123');
  });

  it('handles job failure gracefully', async () => {
    const job = enqueueImageGenerationJob(async () => {
      throw new Error('Generation failed');
    });

    expect(job.status).toBe('pending');

    await job.done;

    const stored = getImageGenerationJob(job.id);
    expect(stored?.status).toBe('error');
    expect(stored?.error).toContain('Generation failed');
  });

  it('returns undefined for non-existent job', () => {
    const stored = getImageGenerationJob('non-existent-id');
    expect(stored).toBeUndefined();
  });
});
