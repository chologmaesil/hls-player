import { MasterManifest, MediaManifest } from '../types/types';
import { LoaderErrors } from '../utils/constants';
import { createBaseUrl } from '../utils/utils';
import { validateMasterManifest, validateMediaManifest } from './validator';
import { parseMasterManifest, parseMediaManifest } from './parser';

export async function loadMasterManifest(manifestUrl: string): Promise<MasterManifest> {
  const baseUrl = createBaseUrl(manifestUrl);
  const manifest = await fetchManifest(manifestUrl);
  validateMasterManifest(manifest);
  return parseMasterManifest(manifest, baseUrl);
}

export async function loadMediaManifest(manifestUrl: string): Promise<MediaManifest> {
  const baseUrl = createBaseUrl(manifestUrl);
  const manifest = await fetchManifest(manifestUrl);
  validateMediaManifest(manifest);
  return parseMediaManifest(manifest, baseUrl);
}

async function fetchManifest(url: string): Promise<string> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(LoaderErrors.HTTP_ERROR(response.status, response.statusText));
    }
    return await response.text();
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error(LoaderErrors.NETWORK_ERROR);
    }
    throw error;
  }
}
