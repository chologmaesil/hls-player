import { ContainerFormat } from '../../manifest';
import { BufferInitializationConfig, MediaSegment } from '../types/types';
import { BufferErrors } from '../utils/constants';

export async function initializeBuffer(
  mediaSource: MediaSource,
  config: BufferInitializationConfig
): Promise<SourceBuffer> {
  if (mediaSource.readyState !== 'open') {
    throw new Error(BufferErrors.INVALID_STATE);
  }

  const sourceBuffer = mediaSource.addSourceBuffer(config.mimeType);

  if (config.containerFormat === ContainerFormat.FRAGMENTED_MP4) {
    if (!config.initSegmentUrl) {
      throw new Error(BufferErrors.INIT_SEGMENT_REQUIRED);
    }

    const initSegment = await loadInitSegment(config.initSegmentUrl);
    await appendInitializationSegment(sourceBuffer, initSegment);
  }

  return sourceBuffer;
}

async function loadInitSegment(url: string): Promise<ArrayBuffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load initialization segment: ${response.status}`);
  }
  return response.arrayBuffer();
}

async function appendInitializationSegment(sourceBuffer: SourceBuffer, initSegment: ArrayBuffer): Promise<void> {
  if (sourceBuffer.updating) {
    await waitForUpdateEnd(sourceBuffer);
  }

  try {
    sourceBuffer.appendBuffer(initSegment);
    await waitForUpdateEnd(sourceBuffer);
  } catch (error) {
    handleBufferError(error);
  }
}

export async function appendMediaSegment(sourceBuffer: SourceBuffer, segment: MediaSegment): Promise<void> {
  if (sourceBuffer.updating) {
    await waitForUpdateEnd(sourceBuffer);
  }

  try {
    sourceBuffer.appendBuffer(segment.data);
    await waitForUpdateEnd(sourceBuffer);
  } catch (error) {
    handleBufferError(error);
  }
}

function handleBufferError(error: unknown): never {
  if (error instanceof DOMException) {
    if (error.name === 'QuotaExceededError') {
      throw new Error(BufferErrors.QUOTA_EXCEEDED);
    }
  }
  throw new Error(BufferErrors.APPEND_ERROR);
}

function waitForUpdateEnd(sourceBuffer: SourceBuffer): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!sourceBuffer.updating) {
      resolve();
      return;
    }

    const handleUpdate = () => {
      cleanup();
      resolve();
    };

    const handleError = (error: Event) => {
      cleanup();
      reject(error);
    };

    const cleanup = () => {
      sourceBuffer.removeEventListener('updateend', handleUpdate);
      sourceBuffer.removeEventListener('error', handleError);
    };

    sourceBuffer.addEventListener('updateend', handleUpdate);
    sourceBuffer.addEventListener('error', handleError);
  });
}
