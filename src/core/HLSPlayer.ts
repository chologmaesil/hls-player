import { BufferController } from './BufferController';
import { PlaylistLoader, Playlist } from './PlaylistLoader';
import { SegmentLoader } from './SegmentLoader';

export interface HLSPlayerConfig {
  video: HTMLVideoElement;
  url: string;
  maxBufferLength?: number;
  autoplay?: boolean;
}

export class HLSPlayer {
  private config: HLSPlayerConfig;
  private playlistLoader: PlaylistLoader;
  private segmentLoader: SegmentLoader;
  private bufferController: BufferController | null = null;
  private isPlaying: boolean;
  private updateInterval: number;

  constructor(config: HLSPlayerConfig) {
    this.config = {
      maxBufferLength: 30,
      autoplay: false,
      ...config,
    };

    this.playlistLoader = new PlaylistLoader(config.url);
    this.segmentLoader = new SegmentLoader();
    this.isPlaying = false;
    this.updateInterval = 0;
  }

  public async load(): Promise<void> {
    try {
      const playlist = await this.playlistLoader.load();

      this.bufferController = new BufferController({
        video: this.config.video,
        mimeType: 'video/mp4; codecs="avc1.42E01E,mp4a.40.2"',
        maxBufferLength: this.config.maxBufferLength,
      });

      await this.bufferController.initialize();

      await this.loadInitialSegments(playlist);

      if (this.config.autoplay) {
        await this.play();
      }

      this.startUpdateLoop();
    } catch (error) {
      throw error;
    }
  }

  private async loadInitialSegments(playlist: Playlist): Promise<void> {
    const initialSegments = playlist.segments.slice(0, 2);

    for (const segment of initialSegments) {
      try {
        const segmentData = await this.segmentLoader.load({
          url: segment.url,
          timeout: 1000,
        });

        await this.bufferController?.append(segmentData.data);
      } catch (error) {
        throw error;
      }
    }
  }

  private startUpdateLoop(): void {
    this.updateInterval = window.setInterval(async () => {
      try {
        const playlist = await this.playlistLoader.load();
        await this.processNewSegments(playlist);
      } catch (error) {
        throw error;
      }
    }, 5000);
  }

  private async processNewSegments(playlist: Playlist): Promise<void> {
    const bufferInfo = this.bufferController?.getBufferInfo();
    const currentBufferEnd = bufferInfo?.length ? bufferInfo[bufferInfo.length - 1].end : 0;

    if (currentBufferEnd - this.config.video.currentTime < 10) {
      for (const segment of playlist.segments) {
        try {
          const segmentData = await this.segmentLoader.load({
            url: segment.url,
          });
          await this.bufferController?.append(segmentData.data);
        } catch (error) {
          throw error;
        }
      }
    }
  }

  public async play(): Promise<void> {
    try {
      await this.config.video.play();
      this.isPlaying = true;
    } catch (error) {
      throw error;
    }
  }

  public pause(): void {
    this.config.video.pause();
    this.isPlaying = false;
  }

  public async seek(time: number): Promise<void> {
    this.config.video.currentTime = time;
    const playlist = await this.playlistLoader.load();
    await this.processNewSegments(playlist);
  }

  public destroy(): void {
    clearInterval(this.updateInterval);
    this.playlistLoader.abort();
    this.segmentLoader.abort();
    this.bufferController?.destroy();
    this.isPlaying = false;
  }

  public getStats() {
    return {
      currentTime: this.config.video.currentTime,
      buffered: this.bufferController?.getBufferInfo(),
      playing: this.isPlaying,
    };
  }
}
