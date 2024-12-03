export type MasterManifest = {
  variants: StreamVariant[];
};

export type StreamVariant = {
  bandwidth: number;
  resolution?: string;
  codecs: string;
  url: string;
};

export type MediaManifest = {
  version: number;
  segments: Segment[];
  targetDuration: number;
  mediaSequence: number;
  endList: boolean;
  containerFormat: ContainerFormat;
  playlistType?: string;
  initializationSegment?: InitSegment;
};

export type Segment = {
  duration: number;
  uri: string;
  sequence: number;
};

export type InitSegment = {
  uri: string;
};

export enum ContainerFormat {
  MPEG_TS = 'ts',
  FRAGMENTED_MP4 = 'm4s',
}

export enum PlaylistType {
  VOD = 'VOD',
  EVENT = 'EVENT',
}
