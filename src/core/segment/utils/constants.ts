export const SegmentDefaults = {
  TIMEOUT: 10000,
  RETRY_COUNT: 3,
  RETRY_DELAY: 1000,
} as const;

export const SegmentErrors = {
  LOAD_ERROR: (status: number, statusText: string) => `Failed to load segment: ${status} ${statusText}`,
  TIMEOUT_ERROR: (timeout: number) => `Segment load timed out after ${timeout}ms`,
  NETWORK_ERROR: 'Network error occurred while loading segment',
  NOT_FOUND_ERROR: 'Segment not found (404 error)',
} as const;
