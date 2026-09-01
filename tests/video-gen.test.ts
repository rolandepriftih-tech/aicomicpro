import { describe, it, expect } from 'vitest';
import { generateVideo } from '../lib/video-gen';

describe('generateVideo', () => {
  it('submits an Ark video task and polls until a video url is returned', async () => {
    const calls: string[] = [];
    const fetchImpl = async (url: URL | RequestInfo, init?: RequestInit) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      calls.push(`${init?.method ?? 'GET'} ${urlStr}`);
      if (init?.method === 'POST') {
        const body = JSON.parse(String(init.body));
        expect(body.model).toBe('seedance-test');
        expect(body.content[0].type).toBe('text');
        expect(body.content[1].type).toBe('image_url');
        return Response.json({ id: 'task-123', status: 'queued' });
      }
      return Response.json({
        id: 'task-123',
        status: 'succeeded',
        content: [{ type: 'video_url', video_url: { url: 'https://cdn.example.com/out.mp4' } }],
      });
    };

    const result = await generateVideo({
      provider: 'ark',
      apiKey: 'test-key',
      baseUrl: 'https://ark.example.com/api/v3',
      model: 'seedance-test',
      mode: 'seedance-image-to-video',
      prompt: 'camera pushes in',
      referenceImages: ['data:image/png;base64,abc'],
      pollIntervalMs: 1,
      timeoutMs: 1000,
      fetchImpl,
    });

    expect(result.videoUrl).toBe('https://cdn.example.com/out.mp4');
    expect(calls).toEqual([
      'POST https://ark.example.com/api/v3/contents/generations/tasks',
      'GET https://ark.example.com/api/v3/contents/generations/tasks/task-123',
    ]);
  });

  it('passes Seedance video controls to the task payload', async () => {
    const fetchImpl = async (_url: URL | RequestInfo, init?: RequestInit) => {
      if (init?.method === 'POST') {
        const body = JSON.parse(String(init.body));
        expect(body.duration).toBe(-1);
        expect(body.ratio).toBe('adaptive');
        expect(body.resolution).toBe('1080p');
        expect(body.generate_audio).toBe(false);
        expect(body.watermark).toBe(true);
        return Response.json({ id: 'task-456', status: 'queued' });
      }
      return Response.json({
        id: 'task-456',
        status: 'succeeded',
        content: { video_url: 'https://cdn.example.com/controls.mp4' },
      });
    };

    const result = await generateVideo({
      provider: 'ark',
      apiKey: 'test-key',
      baseUrl: 'https://ark.example.com/api/plan/v3',
      model: 'doubao-seedance-2.0-pro',
      mode: 'seedance-text-to-video',
      prompt: 'rainy neon street',
      duration: -1,
      aspectRatio: 'adaptive',
      quality: '1080p',
      generateAudio: false,
      watermark: true,
      pollIntervalMs: 1,
      timeoutMs: 1000,
      fetchImpl,
    });

    expect(result.videoUrl).toBe('https://cdn.example.com/controls.mp4');
  });
});

describe('AutoDL ComfyUI generateVideo', () => {
  it('submits request correctly with bare token (no Bearer prefix)', async () => {
    const calls: { method: string; url: string; headers: Record<string, string> }[] = [];
    const fetchImpl = async (url: URL | RequestInfo, init?: RequestInit) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      calls.push({
        method: init?.method ?? 'GET',
        url: urlStr,
        headers: (init?.headers as Record<string, string>) ?? {},
      });
      if (init?.method === 'POST') {
        return Response.json({
          code: 'Success',
          data: { task_id: 'autodl-task-123', workflow: 'H3文生视频', status: 'QUEUED' },
        });
      }
      return Response.json({
        code: 'Success',
        data: { task_id: 'autodl-task-123', status: 'SUCCESS', results: ['https://cdn.autodl.example.com/video.mp4'] },
      });
    };

    const result = await generateVideo({
      provider: 'autodl',
      apiKey: 'test-token-abc',
      baseUrl: 'https://autodl.art/api/v1/comfyui',
      mode: 'autodl-text-to-video',
      prompt: '一个女孩在跳舞',
      duration: 5,
      quality: '480p竖',
      pollIntervalMs: 1,
      timeoutMs: 1000,
      fetchImpl,
    });

    // 验证 POST 请求
    expect(calls[0].method).toBe('POST');
    expect(calls[0].url).toBe('https://autodl.art/api/v1/comfyui/comfyui_workflow/minimax_h3_lightx2v_no_pic');
    // 验证 Authorization 是裸 Token，没有 Bearer 前缀
    expect(calls[0].headers['Authorization']).toBe('test-token-abc');
    expect(calls[0].headers['Authorization']).not.toContain('Bearer');

    // 验证 GET 轮询
    expect(calls[1].method).toBe('GET');
    expect(calls[1].url).toBe('https://autodl.art/api/v1/comfyui/comfyui_workflow/result/autodl-task-123');
    expect(calls[1].headers['Authorization']).toBe('test-token-abc');

    // 验证返回结果
    expect(result.videoUrl).toBe('https://cdn.autodl.example.com/video.mp4');
  });

  it('autodl-text-to-video does not send images in body', async () => {
    let postBody: Record<string, unknown> = {};
    const fetchImpl = async (url: URL | RequestInfo, init?: RequestInit) => {
      if (init?.method === 'POST') {
        postBody = JSON.parse(String(init.body));
        return Response.json({
          code: 'Success',
          data: { task_id: 'task-no-images', status: 'QUEUED' },
        });
      }
      return Response.json({
        code: 'Success',
        data: { task_id: 'task-no-images', status: 'SUCCESS', results: ['https://example.com/video.mp4'] },
      });
    };

    await generateVideo({
      provider: 'autodl',
      apiKey: 'test-token',
      mode: 'autodl-text-to-video',
      prompt: '风景视频',
      pollIntervalMs: 1,
      timeoutMs: 1000,
      fetchImpl,
    });

    // 文生视频模式不应该包含 ref_image_ 字段
    expect(postBody.ref_image_0).toBeUndefined();
    // 应该包含 prompt、duration、resolution
    expect(postBody.prompt).toBe('风景视频');
    expect(postBody.duration).toBe(5);
    expect(postBody.resolution).toBe('480p竖');
  });

  it('polls until success: QUEUED -> SUCCESS', async () => {
    let pollCount = 0;
    const fetchImpl = async (url: URL | RequestInfo, init?: RequestInit) => {
      if (init?.method === 'POST') {
        return Response.json({
          code: 'Success',
          data: { task_id: 'task-poll', status: 'QUEUED' },
        });
      }
      // GET 轮询
      pollCount++;
      if (pollCount === 1) {
        return Response.json({
          code: 'Success',
          data: { task_id: 'task-poll', status: 'QUEUED', results: [] },
        });
      }
      return Response.json({
        code: 'Success',
        data: { task_id: 'task-poll', status: 'SUCCESS', duration: 196, results: ['https://example.com/final.mp4'] },
      });
    };

    const result = await generateVideo({
      provider: 'autodl',
      apiKey: 'test-token',
      mode: 'autodl-text-to-video',
      prompt: '测试轮询',
      pollIntervalMs: 1,
      timeoutMs: 5000,
      fetchImpl,
    });

    expect(pollCount).toBe(2);
    expect(result.videoUrl).toBe('https://example.com/final.mp4');
  });

  it('extracts video URL from results array of objects with url property', async () => {
    const fetchImpl = async (url: URL | RequestInfo, init?: RequestInit) => {
      if (init?.method === 'POST') {
        return Response.json({
          code: 'Success',
          data: { task_id: 'task-obj-results', status: 'QUEUED' },
        });
      }
      // results 是对象数组
      return Response.json({
        code: 'Success',
        data: {
          task_id: 'task-obj-results',
          status: 'SUCCESS',
          results: [{ url: 'https://example.com/video-from-object.mp4' }],
        },
      });
    };

    const result = await generateVideo({
      provider: 'autodl',
      apiKey: 'test-token',
      mode: 'autodl-text-to-video',
      prompt: '对象数组测试',
      pollIntervalMs: 1,
      timeoutMs: 1000,
      fetchImpl,
    });

    expect(result.videoUrl).toBe('https://example.com/video-from-object.mp4');
  });

  it('throws error when status is FAILED', async () => {
    const fetchImpl = async (url: URL | RequestInfo, init?: RequestInit) => {
      if (init?.method === 'POST') {
        return Response.json({
          code: 'Success',
          data: { task_id: 'task-failed', status: 'QUEUED' },
        });
      }
      return Response.json({
        code: 'Success',
        data: {
          task_id: 'task-failed',
          status: 'FAILED',
          message: '工作流执行失败：模型加载错误',
        },
      });
    };

    await expect(
      generateVideo({
        provider: 'autodl',
        apiKey: 'test-token',
        mode: 'autodl-text-to-video',
        prompt: '失败测试',
        pollIntervalMs: 1,
        timeoutMs: 1000,
        fetchImpl,
      })
    ).rejects.toThrow('AutoDL 视频任务失败');
  });

  it('uses workflowId from options over default mapping', async () => {
    let postUrl = '';
    const fetchImpl = async (url: URL | RequestInfo, init?: RequestInit) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      if (init?.method === 'POST') {
        postUrl = urlStr;
        return Response.json({
          code: 'Success',
          data: { task_id: 'task-custom-wf', status: 'QUEUED' },
        });
      }
      return Response.json({
        code: 'Success',
        data: { task_id: 'task-custom-wf', status: 'SUCCESS', results: ['https://example.com/video.mp4'] },
      });
    };

    await generateVideo({
      provider: 'autodl',
      apiKey: 'test-token',
      mode: 'autodl-text-to-video',
      prompt: '自定义 workflow 测试',
      workflowId: 'my_custom_workflow_id',
      pollIntervalMs: 1,
      timeoutMs: 1000,
      fetchImpl,
    });

    // 应该使用自定义的 workflowId
    expect(postUrl).toContain('my_custom_workflow_id');
    expect(postUrl).not.toContain('minimax_h3_lightx2v_no_pic');
  });

  it('autodl-multi-reference sends ref_image_0, ref_image_1 fields', async () => {
    let postBody: Record<string, unknown> = {};
    const fetchImpl = async (url: URL | RequestInfo, init?: RequestInit) => {
      if (init?.method === 'POST') {
        postBody = JSON.parse(String(init.body));
        return Response.json({
          code: 'Success',
          data: { task_id: 'task-multi-ref', status: 'QUEUED' },
        });
      }
      return Response.json({
        code: 'Success',
        data: { task_id: 'task-multi-ref', status: 'SUCCESS', results: ['https://example.com/video.mp4'] },
      });
    };

    await generateVideo({
      provider: 'autodl',
      apiKey: 'test-token',
      mode: 'autodl-multi-reference',
      prompt: '多图参考测试',
      referenceImages: ['https://example.com/img1.jpg', 'https://example.com/img2.jpg'],
      pollIntervalMs: 1,
      timeoutMs: 1000,
      fetchImpl,
    });

    // 应该使用 ref_image_0, ref_image_1 平铺字段
    expect(postBody.ref_image_0).toBe('https://example.com/img1.jpg');
    expect(postBody.ref_image_1).toBe('https://example.com/img2.jpg');
    expect(postBody.ref_image_2).toBeUndefined();
  });

  it('autodl-first-last-frame sends first_frame and last_frame fields', async () => {
    let postBody: Record<string, unknown> = {};
    const fetchImpl = async (url: URL | RequestInfo, init?: RequestInit) => {
      if (init?.method === 'POST') {
        postBody = JSON.parse(String(init.body));
        return Response.json({
          code: 'Success',
          data: { task_id: 'task-first-last', status: 'QUEUED' },
        });
      }
      return Response.json({
        code: 'Success',
        data: { task_id: 'task-first-last', status: 'SUCCESS', results: ['https://example.com/video.mp4'] },
      });
    };

    await generateVideo({
      provider: 'autodl',
      apiKey: 'test-token',
      mode: 'autodl-first-last-frame',
      prompt: '首尾帧测试',
      referenceImages: ['https://example.com/first.jpg', 'https://example.com/last.jpg'],
      pollIntervalMs: 1,
      timeoutMs: 1000,
      fetchImpl,
    });

    // 应该使用 first_frame 和 last_frame 独立字段
    expect(postBody.first_frame).toBe('https://example.com/first.jpg');
    expect(postBody.last_frame).toBe('https://example.com/last.jpg');
    expect(postBody.ref_image_0).toBeUndefined();
  });

  it('autodl-multi-image-audio sends ref_image_0~2 and ref_audio_0~2', async () => {
    let postBody: Record<string, unknown> = {};
    const fetchImpl = async (url: URL | RequestInfo, init?: RequestInit) => {
      if (init?.method === 'POST') {
        postBody = JSON.parse(String(init.body));
        return Response.json({
          code: 'Success',
          data: { task_id: 'task-multi-audio', status: 'QUEUED' },
        });
      }
      return Response.json({
        code: 'Success',
        data: { task_id: 'task-multi-audio', status: 'SUCCESS', results: ['https://example.com/video.mp4'] },
      });
    };

    await generateVideo({
      provider: 'autodl',
      apiKey: 'test-token',
      mode: 'autodl-multi-image-audio',
      prompt: '多图多音频测试',
      referenceImages: ['https://example.com/img1.jpg', 'https://example.com/img2.jpg'],
      referenceAudios: ['https://example.com/audio1.mp3', 'https://example.com/audio2.mp3'],
      pollIntervalMs: 1,
      timeoutMs: 1000,
      fetchImpl,
    });

    // 应该使用 ref_image_0~1 和 ref_audio_0~1
    expect(postBody.ref_image_0).toBe('https://example.com/img1.jpg');
    expect(postBody.ref_image_1).toBe('https://example.com/img2.jpg');
    expect(postBody.ref_audio_0).toBe('https://example.com/audio1.mp3');
    expect(postBody.ref_audio_1).toBe('https://example.com/audio2.mp3');
    expect(postBody.ref_image_2).toBeUndefined();
    expect(postBody.ref_audio_2).toBeUndefined();
  });

  it('autodl-lip-sync sends ref_image_0 and ref_audio_0', async () => {
    let postBody: Record<string, unknown> = {};
    const fetchImpl = async (url: URL | RequestInfo, init?: RequestInit) => {
      if (init?.method === 'POST') {
        postBody = JSON.parse(String(init.body));
        return Response.json({
          code: 'Success',
          data: { task_id: 'task-lip-sync', status: 'QUEUED' },
        });
      }
      return Response.json({
        code: 'Success',
        data: { task_id: 'task-lip-sync', status: 'SUCCESS', results: ['https://example.com/video.mp4'] },
      });
    };

    await generateVideo({
      provider: 'autodl',
      apiKey: 'test-token',
      mode: 'autodl-lip-sync',
      prompt: '音频同步测试',
      referenceImages: ['https://example.com/face.jpg'],
      referenceAudios: ['https://example.com/voice.mp3'],
      pollIntervalMs: 1,
      timeoutMs: 1000,
      fetchImpl,
    });

    // 应该使用 ref_image_0 和 ref_audio_0
    expect(postBody.ref_image_0).toBe('https://example.com/face.jpg');
    expect(postBody.ref_audio_0).toBe('https://example.com/voice.mp3');
    expect(postBody.ref_image_1).toBeUndefined();
    expect(postBody.ref_audio_1).toBeUndefined();
  });
});
