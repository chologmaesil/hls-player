import { MasterManifest, MediaManifest, Segment, InitSegment, ContainerFormat } from '../types/types';
import { MasterManifestPatterns, MediaManifestPatterns, ManifestAttributes } from '../utils/constants';
import { resolveUrl } from '../utils/utils';

export function parseMasterManifest(content: string, baseUrl: string): MasterManifest {
  const variants = [];
  let match;

  while ((match = MasterManifestPatterns.STREAM_INF.exec(content))) {
    const attributes = parseMasterManifestAttributes(match[1]);
    const variantUrl = resolveUrl(match[2], baseUrl);

    variants.push({
      bandwidth: parseInt(attributes[ManifestAttributes.Master.BANDWIDTH]),
      resolution: attributes[ManifestAttributes.Master.RESOLUTION],
      codecs: attributes[ManifestAttributes.Master.CODECS],
      url: variantUrl,
    });
  }

  return { variants };
}

export function parseMediaManifest(content: string, baseUrl: string): MediaManifest {
  return {
    version: parseVersion(content),
    playlistType: parsePlaylistType(content),
    segments: parseSegments(content, baseUrl),
    targetDuration: parseTargetDuration(content),
    mediaSequence: parseMediaSequence(content),
    endList: MediaManifestPatterns.ENDLIST.test(content),
    containerFormat: determineContainerFormat(content),
    initializationSegment: parseInitializationSegment(content, baseUrl),
  };
}

function parseMasterManifestAttributes(attributeString: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  let match;

  while ((match = MasterManifestPatterns.ATTRIBUTES.exec(attributeString))) {
    const key = match[1];
    const value = match[2] || match[3];
    attributes[key] = value;
  }

  return attributes;
}

function parseSegments(content: string, baseUrl: string): Segment[] {
  const segments: Segment[] = [];
  let match;
  const mediaSequence = parseMediaSequence(content);

  MediaManifestPatterns.SEGMENTS.lastIndex = 0;

  while ((match = MediaManifestPatterns.SEGMENTS.exec(content))) {
    segments.push({
      duration: parseFloat(match[1]),
      uri: resolveUrl(match[2], baseUrl),
      sequence: mediaSequence + segments.length,
    });
  }

  return segments;
}

function parseVersion(content: string): number {
  const match = MediaManifestPatterns.VERSION.exec(content);
  return match ? parseInt(match[1]) : 3; // HLS spec defines 3 as implicit version if not specified
}

function parseTargetDuration(manifest: string): number {
  const match = MediaManifestPatterns.TARGET_DURATION.exec(manifest);
  return match ? parseInt(match[1]) : 0;
}

function parseMediaSequence(content: string): number {
  const match = MediaManifestPatterns.MEDIA_SEQUENCE.exec(content);
  return match ? parseInt(match[1]) : 0;
}

function parsePlaylistType(content: string): string | undefined {
  const match = MediaManifestPatterns.PLAYLIST_TYPE.exec(content);
  return match ? match[1] : undefined;
}

function parseInitializationSegment(content: string, baseUrl: string): InitSegment | undefined {
  const match = MediaManifestPatterns.MAP.exec(content);
  return match ? { uri: resolveUrl(match[1], baseUrl) } : undefined;
}

function determineContainerFormat(manifest: string): ContainerFormat {
  return MediaManifestPatterns.MAP.test(manifest) ? ContainerFormat.FRAGMENTED_MP4 : ContainerFormat.MPEG_TS;
}
