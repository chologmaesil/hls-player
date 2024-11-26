export interface Segment {
  url: string;
  duration: number;
  sequence?: number;
}

export interface Playlist {
  segments: Segment[];
  targetDuration: number;
  endList: boolean;
  version?: number;
}

export class PlaylistLoader {
  private url: string;
  private controller: AbortController;

  constructor(url: string) {
    this.url = url;
    this.controller = new AbortController();
  }

  public async load(): Promise<Playlist> {
    try {
      const response = await fetch(this.url, {
        signal: this.controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Failed to load playlist: ${response.status} ${response.statusText}`);
      }

      const text = await response.text();
      return this.parse(text);
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Playlist loading error: ${error.message}`);
      }
      throw error;
    }
  }

  public abort(): void {
    this.controller.abort();
    this.controller = new AbortController();
  }

  public parse(manifest: string): Playlist {
    const lines = manifest.split('\n');
    const playlist: Playlist = {
      segments: [],
      targetDuration: 0,
      endList: false,
    };

    let currentSegment: Partial<Segment> = {};
    let sequence = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      if (!line) continue;

      if (line.startsWith('#')) {
        // 태그 파싱
        if (line.startsWith('#EXTINF:')) {
          const duration = parseFloat(line.substring(8).split(',')[0]);
          currentSegment.duration = duration;
        } else if (line.startsWith('#EXT-X-TARGETDURATION:')) {
          playlist.targetDuration = parseInt(line.substring(22));
        } else if (line === '#EXT-X-ENDLIST') {
          playlist.endList = true;
        } else if (line.startsWith('#EXT-X-VERSION:')) {
          playlist.version = parseInt(line.substring(15));
        }
      } else if (line.length > 0) {
        currentSegment.url = this.resolveUrl(line);
        currentSegment.sequence = sequence++;
        playlist.segments.push(currentSegment as Segment);
        currentSegment = {};
      }
    }

    return playlist;
  }

  private resolveUrl(url: string): string {
    try {
      return new URL(url, this.url).toString();
    } catch {
      return url;
    }
  }
}
