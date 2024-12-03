export const CommonPatterns = {
  EXTM3U: /#EXTM3U/,
} as const;

export const MasterManifestPatterns = {
  STREAM_INF: /#EXT-X-STREAM-INF:([^\n]*)[\r\n]+([^\r\n]+)/g,
  ATTRIBUTES: /([A-Z0-9-]+)=(?:"([^"]*)"|([^,]*))(?:,|$)/g,
} as const;

export const MediaManifestPatterns = {
  VERSION: /#EXT-X-VERSION:(\d+)/,
  PLAYLIST_TYPE: /#EXT-X-PLAYLIST-TYPE:(VOD|EVENT)/,
  TARGET_DURATION: /#EXT-X-TARGETDURATION:(\d+)/,
  MEDIA_SEQUENCE: /#EXT-X-MEDIA-SEQUENCE:(\d+)/,
  SEGMENTS: /#EXTINF:([\d.]+),?\s*\n+([^\n]+)/g,
  MAP: /#EXT-X-MAP:URI="([^"]+)"/,
  ENDLIST: /#EXT-X-ENDLIST/,
} as const;

export const ManifestAttributes = {
  Master: {
    BANDWIDTH: 'BANDWIDTH',
    RESOLUTION: 'RESOLUTION',
    CODECS: 'CODECS',
  },
} as const;

export const ValidatorMessages = {
  Errors: {
    INVALID_MANIFEST: 'Invalid manifest: Missing #EXTM3U tag',
    NO_VARIANTS: 'Invalid master manifest: No stream variants found',
    NO_SEGMENTS: 'Invalid media manifest: No segments found',
  },
  Warnings: {
    MISSING_TARGET_DURATION: 'Required tag #EXT-X-TARGETDURATION is missing. This may cause playback issues.',
    MISSING_VERSION: 'Tag #EXT-X-VERSION is missing. Using default version 3.',
    MISSING_MEDIA_SEQUENCE: 'Tag #EXT-X-MEDIA-SEQUENCE is missing. Using default value 0.',
    VOD_MISSING_ENDLIST: 'VOD manifest is missing #EXT-X-ENDLIST tag. This may cause unexpected behavior.',
    FMP4_MISSING_INIT: 'Fragmented MP4 manifest is missing initialization segment URI.',
  },
} as const;

export const LoaderErrors = {
  HTTP_ERROR: (status: number, statusText: string) => `Failed to load manifest: ${status} ${statusText}`,
  NETWORK_ERROR: 'Network error occurred while loading manifest',
} as const;
