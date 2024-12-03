import { CommonPatterns, MasterManifestPatterns, MediaManifestPatterns, ValidatorMessages } from '../utils/constants';
import { PlaylistType } from '../types/types';

export function validateMasterManifest(manifest: string): void {
  if (!CommonPatterns.EXTM3U.test(manifest)) {
    throw new Error(ValidatorMessages.Errors.INVALID_MANIFEST);
  }

  if (!MasterManifestPatterns.STREAM_INF.test(manifest)) {
    throw new Error(ValidatorMessages.Errors.NO_VARIANTS);
  }
}

export function validateMediaManifest(manifest: string): void {
  if (!CommonPatterns.EXTM3U.test(manifest)) {
    throw new Error(ValidatorMessages.Errors.INVALID_MANIFEST);
  }

  if (!MediaManifestPatterns.SEGMENTS.test(manifest)) {
    throw new Error(ValidatorMessages.Errors.NO_SEGMENTS);
  }

  if (!MediaManifestPatterns.TARGET_DURATION.test(manifest)) {
    console.warn(ValidatorMessages.Warnings.MISSING_TARGET_DURATION);
  }

  if (!MediaManifestPatterns.VERSION.test(manifest)) {
    console.warn(ValidatorMessages.Warnings.MISSING_VERSION);
  }

  if (!MediaManifestPatterns.MEDIA_SEQUENCE.test(manifest)) {
    console.warn(ValidatorMessages.Warnings.MISSING_MEDIA_SEQUENCE);
  }

  const playlistTypeMatch = MediaManifestPatterns.PLAYLIST_TYPE.exec(manifest);
  if (playlistTypeMatch && playlistTypeMatch[1] === PlaylistType.VOD && !MediaManifestPatterns.ENDLIST.test(manifest)) {
    console.warn(ValidatorMessages.Warnings.VOD_MISSING_ENDLIST);
  }

  if (MediaManifestPatterns.MAP.test(manifest)) {
    if (!MediaManifestPatterns.MAP.exec(manifest)?.[1]) {
      console.warn(ValidatorMessages.Warnings.FMP4_MISSING_INIT);
    }
  }
}
