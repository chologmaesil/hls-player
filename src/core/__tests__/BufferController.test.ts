/**
 * @vitest-environment happy-dom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BufferController, type BufferControllerConfig } from '../BufferController';

// MediaSource 모킹
class MockMediaSource {
  public readyState = 'closed';
  private sourceBuffers: MockSourceBuffer[] = [];
  private onSourceOpen: (() => void) | null = null;

  constructor() {
    setTimeout(() => {
      this.readyState = 'open';
      this.onSourceOpen?.();
    }, 0);
  }

  addEventListener(event: string, callback: () => void) {
    if (event === 'sourceopen') {
      this.onSourceOpen = callback;
    }
  }

  addSourceBuffer(mimeType: string) {
    const sourceBuffer = new MockSourceBuffer();
    this.sourceBuffers.push(sourceBuffer);
    return sourceBuffer;
  }

  removeSourceBuffer(sourceBuffer: MockSourceBuffer) {
    this.sourceBuffers = this.sourceBuffers.filter(sb => sb !== sourceBuffer);
  }

  endOfStream() {
    this.readyState = 'ended';
  }
}

// SourceBuffer 모킹
class MockSourceBuffer {
  public updating = false;
  public buffered = {
    length: 1,
    start: (i: number) => 0,
    end: (i: number) => 30,
  };
  private onUpdateEnd: (() => void) | null = null;

  addEventListener(event: string, callback: () => void) {
    if (event === 'updateend') {
      this.onUpdateEnd = callback;
    }
  }

  appendBuffer(buffer: ArrayBuffer) {
    this.updating = true;
    setTimeout(() => {
      this.updating = false;
      this.onUpdateEnd?.();
    }, 0);
  }

  remove(start: number, end: number) {
    this.updating = true;
    setTimeout(() => {
      this.updating = false;
      this.onUpdateEnd?.();
    }, 0);
  }

  abort() {}
}

// URL 모킹
globalThis.URL = {
  createObjectURL: vi.fn().mockReturnValue('blob:mock-url'),
  revokeObjectURL: vi.fn(),
} as any;

describe('BufferController', () => {
  let video: HTMLVideoElement;
  let bufferController: BufferController;
  let config: BufferControllerConfig;

  beforeEach(() => {
    // @ts-ignore
    global.MediaSource = MockMediaSource;

    video = document.createElement('video');
    config = {
      video,
      mimeType: 'video/mp4; codecs="avc1.42E01E,mp4a.40.2"',
      maxBufferLength: 60,
    };
    bufferController = new BufferController(config);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize successfully', async () => {
    await expect(bufferController.initialize()).resolves.not.toThrow();
    expect(video.src).toBe('blob:mock-url');
  });

  it('should append buffer segments', async () => {
    await bufferController.initialize();
    const segment = new ArrayBuffer(1024);
    await expect(bufferController.append(segment)).resolves.not.toThrow();
  });

  it('should queue segments when updating', async () => {
    await bufferController.initialize();
    const segment1 = new ArrayBuffer(1024);
    const segment2 = new ArrayBuffer(1024);

    await bufferController.append(segment1);
    await bufferController.append(segment2);
  });

  it('should get buffer info', async () => {
    await bufferController.initialize();
    const bufferInfo = bufferController.getBufferInfo();

    expect(bufferInfo).toEqual([
      {
        start: 0,
        end: 30,
      },
    ]);
  });

  it('should destroy properly', async () => {
    await bufferController.initialize();
    await expect(bufferController.destroy()).resolves.not.toThrow();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
  });

  it('should handle buffer removal when exceeding maxBufferLength', async () => {
    await bufferController.initialize();

    video.currentTime = 50;

    const segment = new ArrayBuffer(1024);
    await bufferController.append(segment);
    await expect(bufferController.append(segment)).resolves.not.toThrow();
  });

  it('should throw error when appending buffer before initialization', async () => {
    const segment = new ArrayBuffer(1024);
    await expect(bufferController.append(segment)).rejects.toThrow('SourceBuffer not initialized');
  });
});
