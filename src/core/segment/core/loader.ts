import { SegmentLoadOptions, SegmentLoadResult } from '../types/types';
import { SegmentDefaults, SegmentErrors } from '../utils/constants';
import { timeoutPromise } from '../utils/utils';

export async function loadSegment(
  url: string,
  sequence: number,
  duration: number,
  options: SegmentLoadOptions = {}
): Promise<SegmentLoadResult> {
  const { timeout = SegmentDefaults.TIMEOUT, retryCount = SegmentDefaults.RETRY_COUNT } = options;

  const timeoutErrorMessage = SegmentErrors.TIMEOUT_ERROR(timeout);

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < retryCount; attempt++) {
    try {
      const response = await Promise.race([fetch(url), timeoutPromise(timeout, timeoutErrorMessage)]);

      if (!response.ok) {
        throw new Error(SegmentErrors.LOAD_ERROR(response.status, response.statusText));
      }

      if (response.status === 404) {
        throw new Error(SegmentErrors.NOT_FOUND_ERROR);
      }

      const data = await response.arrayBuffer();
      return { data, sequence, duration };
    } catch (error) {
      lastError = error as Error;
      if (attempt < retryCount - 1) {
        await new Promise(resolve => setTimeout(resolve, SegmentDefaults.RETRY_DELAY));
      }
    }
  }

  throw lastError;
}
