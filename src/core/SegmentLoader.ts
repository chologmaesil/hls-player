export interface SegmentLoadOptions {
  url: string;
  responseType?: 'arraybuffer';
  timeout?: number;
}

export interface SegmentData {
  data: ArrayBuffer;
  duration: number;
  sequence: number;
}

export class SegmentLoader {
  private controller: AbortController;

  constructor() {
    this.controller = new AbortController();
  }

  public async load({ url, timeout = 10000 }: SegmentLoadOptions): Promise<SegmentData> {
    this.abort();
    this.controller = new AbortController();

    try {
      const timeoutId = setTimeout(() => this.controller.abort(), timeout);

      const response = await fetch(url, {
        signal: this.controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Segment loading failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.arrayBuffer();

      return {
        data,
        duration: 0,
        sequence: 0,
      };
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error('Segment loading aborted');
        }
        throw new Error(`Segment loading error: ${error.message}`);
      }
      throw error;
    }
  }

  public abort(): void {
    this.controller.abort();
  }
}
