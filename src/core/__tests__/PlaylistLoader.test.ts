import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PlaylistLoader } from '../PlaylistLoader';

describe('PlaylistLoader', () => {
  let loader: PlaylistLoader;
  const TEST_URL = 'https://example.com/stream.m3u8';

  beforeEach(() => {
    loader = new PlaylistLoader(TEST_URL);
  });

  describe('parse', () => {
    it('should parse a basic VOD playlist', async () => {
      const manifest = `
            #EXTM3U
            #EXT-X-VERSION:3
            #EXT-X-TARGETDURATION:10
            #EXTINF:9.009,
            segment1.ts
            #EXTINF:9.009,
            segment2.ts
            #EXTINF:9.009,
            segment3.ts
            #EXT-X-ENDLIST
                  `.trim();

      const playlist = loader.parse(manifest);

      expect(playlist.version).toBe(3);
      expect(playlist.targetDuration).toBe(10);
      expect(playlist.endList).toBe(true);
      expect(playlist.segments).toHaveLength(3);
      expect(playlist.segments[0]).toEqual({
        duration: 9.009,
        url: 'https://example.com/segment1.ts',
        sequence: 0,
      });
    });

    it('should parse a live playlist', async () => {
      const manifest = `
  #EXTM3U
  #EXT-X-VERSION:3
  #EXT-X-TARGETDURATION:10
  #EXTINF:9.009,
  segment1.ts
  #EXTINF:9.009,
  segment2.ts
        `.trim();

      const playlist = loader.parse(manifest);

      expect(playlist.endList).toBe(false);
      expect(playlist.segments).toHaveLength(2);
    });
  });

  describe('load', () => {
    it('should handle network errors', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      await expect(loader.load()).rejects.toThrow('Network error');
    });

    it('should handle non-200 responses', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      await expect(loader.load()).rejects.toThrow('404 Not Found');
    });

    it('should abort ongoing requests', async () => {
      globalThis.fetch = vi.fn().mockImplementation((_, { signal }) => {
        return new Promise((resolve, reject) => {
          const timeoutId = setTimeout(() => {
            resolve(new Response(''));
          }, 1000);

          if (signal) {
            signal.addEventListener('abort', () => {
              clearTimeout(timeoutId);
              reject(new DOMException('The user aborted a request.', 'AbortError'));
            });
          }
        });
      });
      const loadPromise = loader.load();
      loader.abort();

      await expect(loadPromise).rejects.toThrow('abort');
    });
  });
});
