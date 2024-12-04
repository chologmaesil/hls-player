import { loadMasterManifest, loadMediaManifest, MediaManifest, StreamVariant } from '../manifest';
import { loadSegment } from '../segment';
import { initializeBuffer } from '../buffer';

interface QualityLevel {
  level: number;
  width: number;
  height: number;
  bitrate: number;
  url: string;
  codecs: string;
}

export interface HLSControllerConfig {
  videoElement: HTMLVideoElement;
  initialBufferSize?: number;
  maxBufferSize?: number;
  preferredBitrate?: number;
  liveMaxLatency?: number;
  liveRefreshInterval?: number;
  liveSegmentBuffer?: number;
  bandwidthSafetyFactor?: number;
}

export class HLSController {
  private mediaSource: MediaSource;
  private sourceBuffer: SourceBuffer | null = null;
  private currentManifest: MediaManifest | null = null;
  private currentVariant: StreamVariant | null = null;
  private mediaSourceReady = false;
  private manifestRefreshTimer: number | null = null;
  private isLiveStream = false;

  private segmentQueue: Array<{
    sequence: number;
    data: ArrayBuffer;
  }> = [];
  private isProcessingQueue = false;
  private lastProcessedSequence = -1;
  private isBuffering = false;

  private currentLevel = -1;
  private levels: QualityLevel[] = [];
  private downloadSamples: Array<{ duration: number; bytes: number }> = [];
  private readonly MAX_SAMPLES = 10;

  private readonly config: Required<HLSControllerConfig>;
  private readonly defaultConfig = {
    initialBufferSize: 3,
    maxBufferSize: 6,
    preferredBitrate: 0,
    liveMaxLatency: 20,
    liveRefreshInterval: 2000,
    liveSegmentBuffer: 3,
    bandwidthSafetyFactor: 0.7,
  };

  constructor(config: HLSControllerConfig) {
    this.config = { ...this.defaultConfig, ...config };
    this.mediaSource = new MediaSource();
    this.config.videoElement.src = URL.createObjectURL(this.mediaSource);
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this.mediaSource.addEventListener('sourceopen', () => {
      this.mediaSourceReady = true;
    });

    this.config.videoElement.addEventListener('timeupdate', () => {
      this.handleTimeUpdate();
    });

    this.config.videoElement.addEventListener('waiting', () => {
      this.startBuffering();
    });

    this.config.videoElement.addEventListener('playing', () => {
      if (this.isLiveStream) {
        this.monitorLiveLatency();
      }
    });
  }

  public async loadStream(manifestUrl: string): Promise<void> {
    try {
      const masterManifest = await loadMasterManifest(manifestUrl);
      this.initializeLevels(masterManifest.variants);
      this.currentVariant = this.selectVariant();

      await this.initializeStream(this.currentVariant.url);
      await this.startPlayback();
    } catch (error) {
      console.error('Failed to load stream:', error);
      throw error;
    }
  }

  private initializeLevels(variants: StreamVariant[]): void {
    const sortedVariants = [...variants].sort((a, b) => a.bandwidth - b.bandwidth);

    this.levels = sortedVariants.map((variant, index) => {
      const [width, height] = this.parseResolution(variant.resolution);
      return {
        level: index,
        width,
        height,
        bitrate: variant.bandwidth,
        url: variant.url,
        codecs: variant.codecs,
      };
    });
  }

  private parseResolution(resolution: string | undefined): [number, number] {
    if (!resolution) return [0, 0];
    const [width, height] = resolution.split('x').map(Number);
    return [width, height];
  }

  public setQualityLevel(level: number): void {
    if (level >= -1 && level < this.levels.length && level !== this.currentLevel) {
      this.currentLevel = level;
      const newVariant = this.selectVariant();

      if (newVariant.url !== this.currentVariant?.url) {
        this.currentVariant = newVariant;
        this.reloadStream();
      }
    }
  }

  private async reloadStream(): Promise<void> {
    if (!this.currentVariant) return;

    const currentTime = this.config.videoElement.currentTime;
    await this.loadManifest(this.currentVariant.url);

    if (this.sourceBuffer && this.sourceBuffer.buffered.length > 0) {
      await this.clearBuffer();
    }

    this.lastProcessedSequence = -1;
    this.segmentQueue = [];
    await this.startBuffering();
    this.config.videoElement.currentTime = currentTime;
  }

  private selectVariant(): StreamVariant {
    let selectedLevel: QualityLevel;

    if (this.currentLevel === -1) {
      const estimatedBandwidth = this.estimateAvailableBandwidth();
      const safeBandwidth = estimatedBandwidth * this.config.bandwidthSafetyFactor;

      selectedLevel = this.levels[0]; // 기본값으로 최저 품질 설정
      for (let i = this.levels.length - 1; i >= 0; i--) {
        if (this.levels[i].bitrate <= safeBandwidth) {
          selectedLevel = this.levels[i];
          break;
        }
      }
    } else {
      selectedLevel = this.levels[this.currentLevel];
    }

    return {
      bandwidth: selectedLevel.bitrate,
      codecs: selectedLevel.codecs,
      url: selectedLevel.url,
      resolution:
        selectedLevel.width && selectedLevel.height ? `${selectedLevel.width}x${selectedLevel.height}` : undefined,
    };
  }

  private async initializeStream(manifestUrl: string): Promise<void> {
    await this.loadManifest(manifestUrl);
    await this.detectStreamType();
    await this.initializeMediaSource();
  }

  private async loadManifest(manifestUrl: string): Promise<void> {
    this.currentManifest = await loadMediaManifest(manifestUrl);
  }

  private async detectStreamType(): Promise<void> {
    if (!this.currentManifest) throw new Error('No manifest loaded');

    this.isLiveStream = !this.currentManifest.endList;

    if (this.isLiveStream) {
      this.setupLiveStreamHandling();
    }
  }

  private async initializeMediaSource(): Promise<void> {
    if (!this.currentVariant || !this.currentManifest) {
      throw new Error('No variant or manifest selected');
    }

    await this.waitForMediaSource();

    this.sourceBuffer = await initializeBuffer(this.mediaSource, {
      mimeType: `video/mp4; codecs="${this.currentVariant.codecs}"`,
      containerFormat: this.currentManifest.containerFormat,
      initSegmentUrl: this.currentManifest.initializationSegment?.uri,
    });

    // 라이브 스트리밍인 경우 sequence 모드 설정
    if (this.isLiveStream && this.sourceBuffer.mode !== 'sequence') {
      this.sourceBuffer.mode = 'sequence';
    }
  }

  private setupLiveStreamHandling(): void {
    if (!this.currentVariant) return;

    this.manifestRefreshTimer = window.setInterval(async () => {
      try {
        const updatedManifest = await loadMediaManifest(this.currentVariant!.url);
        await this.handleManifestUpdate(updatedManifest);
      } catch (error) {
        console.error('Failed to refresh manifest:', error);
      }
    }, this.config.liveRefreshInterval);
  }

  private async handleManifestUpdate(updatedManifest: MediaManifest): Promise<void> {
    if (!this.currentManifest) return;

    const newSegments = this.findNewSegments(updatedManifest);
    for (const segment of newSegments) {
      await this.loadAndBufferSegment(segment);
    }

    this.currentManifest = updatedManifest;
  }

  private findNewSegments(updatedManifest: MediaManifest) {
    if (!this.currentManifest) return [];

    const currentLastSegment = this.currentManifest.segments[this.currentManifest.segments.length - 1];
    return updatedManifest.segments.filter(segment => segment.sequence > currentLastSegment.sequence);
  }

  private async startPlayback(): Promise<void> {
    await this.startBuffering();
    await this.config.videoElement.play();
  }

  private async startBuffering(): Promise<void> {
    if (this.isBuffering || !this.currentManifest || !this.sourceBuffer) {
      return;
    }

    this.isBuffering = true;

    try {
      const targetBufferSize = this.isLiveStream ? this.config.liveSegmentBuffer : this.config.initialBufferSize;

      const segments = this.currentManifest.segments.slice(
        this.lastProcessedSequence + 1,
        this.lastProcessedSequence + 1 + targetBufferSize
      );

      for (const segment of segments) {
        await this.loadAndBufferSegment(segment);
      }
    } finally {
      this.isBuffering = false;
    }
  }

  private async loadAndBufferSegment(segment: { uri: string; sequence: number; duration: number }): Promise<void> {
    try {
      const startTime = performance.now();
      const segmentData = await loadSegment(segment.uri, segment.sequence, segment.duration);
      const endTime = performance.now();

      this.updateBandwidthEstimate(endTime - startTime, segmentData.data.byteLength);
      await this.addToSegmentQueue(segment.sequence, segmentData.data);
    } catch (error) {
      console.error('Failed to load segment:', error);
      throw error;
    }
  }

  private updateBandwidthEstimate(duration: number, bytes: number): void {
    this.downloadSamples.push({
      duration: duration / 1000,
      bytes: bytes,
    });

    if (this.downloadSamples.length > this.MAX_SAMPLES) {
      this.downloadSamples.shift();
    }

    if (this.currentLevel === -1) {
      const newVariant = this.selectVariant();
      if (newVariant.bandwidth !== this.currentVariant?.bandwidth) {
        this.currentVariant = newVariant;
        this.reloadStream();
      }
    }
  }

  private estimateAvailableBandwidth(): number {
    if (this.downloadSamples.length === 0) {
      return Infinity;
    }

    const totalDuration = this.downloadSamples.reduce((sum, sample) => sum + sample.duration, 0);
    const totalBytes = this.downloadSamples.reduce((sum, sample) => sum + sample.bytes, 0);

    return (totalBytes * 8) / totalDuration;
  }

  private async addToSegmentQueue(sequence: number, data: ArrayBuffer): Promise<void> {
    if (sequence <= this.lastProcessedSequence) {
      return;
    }

    this.segmentQueue.push({ sequence, data });
    this.segmentQueue.sort((a, b) => a.sequence - b.sequence);

    if (!this.isProcessingQueue) {
      await this.processSegmentQueue();
    }
  }

  private async processSegmentQueue(): Promise<void> {
    if (this.isProcessingQueue || !this.sourceBuffer || this.segmentQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    try {
      while (this.segmentQueue.length > 0) {
        const segment = this.segmentQueue[0];

        if (this.lastProcessedSequence !== -1 && segment.sequence !== this.lastProcessedSequence + 1) {
          break;
        }

        if (this.sourceBuffer.updating) {
          await this.waitForSourceBufferUpdate();
          continue;
        }

        if (this.lastProcessedSequence === -1 && this.isLiveStream) {
          this.sourceBuffer.mode = 'sequence';
        }

        this.sourceBuffer.appendBuffer(segment.data);
        await this.waitForSourceBufferUpdate();

        this.lastProcessedSequence = segment.sequence;
        this.segmentQueue.shift();
      }
    } finally {
      this.isProcessingQueue = false;
    }
  }

  public getQualityLevels(): QualityLevel[] {
    return this.levels;
  }

  public getCurrentLevel(): number {
    return this.currentLevel;
  }

  private async clearBuffer(): Promise<void> {
    if (!this.sourceBuffer) return;

    // Remove all buffered segments
    for (let i = 0; i < this.sourceBuffer.buffered.length; i++) {
      const start = this.sourceBuffer.buffered.start(i);
      const end = this.sourceBuffer.buffered.end(i);
      this.sourceBuffer.remove(start, end);
      await this.waitForSourceBufferUpdate();
    }
  }

  private async waitForSourceBufferUpdate(): Promise<void> {
    if (!this.sourceBuffer?.updating) {
      return;
    }

    return new Promise(resolve => {
      const handleUpdateEnd = () => {
        this.sourceBuffer?.removeEventListener('updateend', handleUpdateEnd);
        resolve();
      };

      this.sourceBuffer?.addEventListener('updateend', handleUpdateEnd);
    });
  }

  private handleTimeUpdate(): void {
    if (!this.currentManifest || !this.sourceBuffer) return;

    const currentTime = this.config.videoElement.currentTime;
    const buffered = this.sourceBuffer.buffered;

    if (buffered.length > 0) {
      const bufferedEnd = buffered.end(buffered.length - 1);
      const bufferAhead = bufferedEnd - currentTime;

      if (bufferAhead < this.currentManifest.targetDuration * 2) {
        this.startBuffering();
      }

      // 라이브 스트리밍에서 오래된 버퍼 제거
      if (this.isLiveStream) {
        const removeEnd = currentTime - this.config.liveSegmentBuffer * this.currentManifest.targetDuration;
        if (buffered.start(0) < removeEnd) {
          this.sourceBuffer.remove(buffered.start(0), removeEnd);
        }
      }
    }
  }

  private monitorLiveLatency(): void {
    if (!this.currentManifest || !this.isLiveStream) return;

    const currentTime = this.config.videoElement.currentTime;
    const buffered = this.sourceBuffer?.buffered;

    if (buffered && buffered.length > 0) {
      const latency = buffered.end(buffered.length - 1) - currentTime;

      if (latency > this.config.liveMaxLatency) {
        const targetTime = buffered.end(buffered.length - 1) - this.config.liveMaxLatency / 2;
        this.config.videoElement.currentTime = targetTime;
      }
    }
  }

  private waitForMediaSource(): Promise<void> {
    return new Promise(resolve => {
      if (this.mediaSourceReady) {
        resolve();
        return;
      }

      const handleSourceOpen = () => {
        this.mediaSource.removeEventListener('sourceopen', handleSourceOpen);
        this.mediaSourceReady = true;
        resolve();
      };

      this.mediaSource.addEventListener('sourceopen', handleSourceOpen);
    });
  }

  public dispose(): void {
    if (this.manifestRefreshTimer !== null) {
      clearInterval(this.manifestRefreshTimer);
    }

    this.config.videoElement.src = '';
    this.sourceBuffer = null;
  }
}
