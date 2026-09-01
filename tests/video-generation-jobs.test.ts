import { describe, it, expect } from 'vitest';
import {
  enqueueVideoGenerationJob,
  getVideoGenerationJob,
} from '../lib/video-generation-jobs';

describe('video generation jobs', () => {
  it('returns pending immediately and stores the completed video later', async () => {
    const job = enqueueVideoGenerationJob(async () => ({
      videoUrl: 'https://example.com/generated.mp4',
    }));

    expect(job.status).toBe('pending');

    await job.done;

    const stored = getVideoGenerationJob(job.id);
    expect(stored?.status).toBe('success');
    expect(stored?.videoUrl).toBe('https://example.com/generated.mp4');
    expect('imageUrl' in (stored ?? {})).toBe(false);
  });

  it('handles job failure gracefully', async () => {
    const job = enqueueVideoGenerationJob(async () => {
      throw new Error('Video generation failed');
    });

    expect(job.status).toBe('pending');

    await job.done;

    const stored = getVideoGenerationJob(job.id);
    expect(stored?.status).toBe('error');
    expect(stored?.error).toContain('Video generation failed');
  });

  it('returns undefined for non-existent job', () => {
    const stored = getVideoGenerationJob('non-existent-id');
    expect(stored).toBeUndefined();
  });
});
