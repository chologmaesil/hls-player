export interface BufferControllerConfig {
  video: HTMLVideoElement;
  mimeType: string; // 예: 'video/mp4; codecs="avc1.42E01E,mp4a.40.2"
  maxBufferLength?: number; //최대 버퍼 길이
}

export class BufferController {
  private mediaSource: MediaSource;
  private sourceBuffer: SourceBuffer | null;
  private video: HTMLVideoElement;
  private mimeType: string;
  private maxBufferLength: number;
  private queue: Array<ArrayBuffer>;
  private updating: boolean;

  constructor({ video, mimeType, maxBufferLength = 60 }: BufferControllerConfig) {
    this.video = video;
    this.mimeType = mimeType;
    this.maxBufferLength = maxBufferLength;
    this.mediaSource = new MediaSource();
    this.sourceBuffer = null;
    this.queue = [];
    this.updating = false;

    this.video.src = URL.createObjectURL(this.mediaSource);
  }

  public async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.mediaSource.addEventListener(
        'sourceopen',
        () => {
          try {
            this.sourceBuffer = this.mediaSource.addSourceBuffer(this.mimeType);
            this.sourceBuffer.addEventListener('updateend', () => {
              this.updating = false;
              this.processQueue();
            });
            resolve();
          } catch (error) {
            reject(new Error(`Failed to initialize SourceBuffer: ${error}`));
          }
        },
        { once: true }
      );
    });
  }

  public async append(segment: ArrayBuffer): Promise<void> {
    if (!this.sourceBuffer) {
      throw new Error('SourceBuffer not initialized');
    }

    if (this.shouldRemoveBuffer()) {
      await this.removeBuffer();
    }

    if (this.updating) {
      this.queue.push(segment);
      return;
    }

    try {
      this.updating = true;
      this.sourceBuffer.appendBuffer(segment);
    } catch (error) {
      this.updating = false;
      throw new Error(`Failed to append segment: ${error}`);
    }
  }

  private shouldRemoveBuffer(): boolean {
    if (!this.sourceBuffer || !this.sourceBuffer.buffered.length) {
      return false;
    }

    const currentTime = this.video.currentTime;
    const bufferEnd = this.sourceBuffer.buffered.end(this.sourceBuffer.buffered.length - 1);

    return bufferEnd - currentTime > this.maxBufferLength;
  }

  private removeBuffer(): Promise<void> {
    if (!this.sourceBuffer || this.sourceBuffer.updating) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      try {
        const currentTime = this.video.currentTime;
        const removeEnd = currentTime - 10;

        if (removeEnd > 0) {
          this.sourceBuffer!.remove(0, removeEnd);
        }

        this.sourceBuffer!.addEventListener(
          'updateend',
          () => {
            resolve();
          },
          { once: true }
        );
      } catch (error) {
        reject(new Error(`Failed to remove buffer: ${error}`));
      }
    });
  }

  private processQueue(): void {
    if (this.queue.length && !this.updating && this.sourceBuffer) {
      const segment = this.queue.shift();
      if (segment) {
        this.append(segment);
      }
    }
  }

  public getBufferInfo(): { start: number; end: number }[] {
    if (!this.sourceBuffer || !this.sourceBuffer.buffered.length) {
      return [];
    }

    const info = [];
    for (let i = 0; i < this.sourceBuffer.buffered.length; i++) {
      info.push({
        start: this.sourceBuffer.buffered.start(i),
        end: this.sourceBuffer.buffered.end(i),
      });
    }
    return info;
  }

  public async destroy(): Promise<void> {
    if (this.sourceBuffer && this.mediaSource.readyState === 'open') {
      this.sourceBuffer.abort();
      this.mediaSource.removeSourceBuffer(this.sourceBuffer);
    }
    if (this.mediaSource.readyState === 'open') {
      this.mediaSource.endOfStream();
    }
    URL.revokeObjectURL(this.video.src);
    this.queue = [];
  }
}
