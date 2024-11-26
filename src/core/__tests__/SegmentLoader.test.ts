import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SegmentLoader } from '../SegmentLoader';

describe('SegmentLoader', () => {
  let loader: SegmentLoader;
  const TEST_URL = 'https://example.com/segment-1.ts';

  beforeEach(() => {
    loader = new SegmentLoader();
    vi.clearAllMocks();
  });

  it('should load segment data successfully', async () => {
    const mockArrayBuffer = new ArrayBuffer(8);

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(mockArrayBuffer),
    });

    const result = await loader.load({ url: TEST_URL });

    expect(result.data).toBe(mockArrayBuffer);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      TEST_URL,
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
  });

  it('should abort ongoing segment load', async () => {
    globalThis.fetch = vi.fn().mockImplementation((_, { signal }) => {
      return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          resolve(new Response(new ArrayBuffer(8)));
        }, 1000);

        if (signal) {
          signal.addEventListener('abort', () => {
            clearTimeout(timeoutId);
            reject(new DOMException('The user aborted a request.', 'AbortError'));
          });
        }
      });
    });
    const loadPromise = loader.load({ url: TEST_URL });
    loader.abort();

    await expect(loadPromise).rejects.toThrow('abort');
  });

  it('should handle failed responses', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    });

    await expect(loader.load({ url: TEST_URL })).rejects.toThrow('Segment loading failed: 404 Not Found');
  });

  it('should handle network errors', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    await expect(loader.load({ url: TEST_URL })).rejects.toThrow('Segment loading error: Network error');
  });

  it('should handle timeout', async () => {
    vi.useFakeTimers();

    globalThis.fetch = vi.fn().mockImplementation((_, { signal }) => {
      return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          resolve(new Response(new ArrayBuffer(8)));
        }, 11000);

        signal?.addEventListener('abort', () => {
          clearTimeout(timeoutId);
          reject(new DOMException('The user aborted a request.', 'AbortError'));
        });
      });
    });

    const loadPromise = loader.load({
      url: TEST_URL,
      timeout: 5000,
    });

    vi.advanceTimersByTime(6000);

    await expect(loadPromise).rejects.toThrow('abort');

    vi.useRealTimers();
  });
});
