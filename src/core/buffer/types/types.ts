import { ContainerFormat } from '../../manifest';

export type BufferInitializationConfig = {
  mimeType: string;
  containerFormat: ContainerFormat;
  initSegmentUrl?: string;
};

export type BufferAppendOptions = {
  sequence: number;
  duration: number;
};

export type InitializationSegment = {
  data: ArrayBuffer;
};

export type MediaSegment = {
  data: ArrayBuffer;
  duration: number;
  sequence: number;
};
