export const BufferErrors = {
  INVALID_STATE: 'MediaSource is not in open state',
  QUOTA_EXCEEDED: 'Buffer quota exceeded. Consider removing old segments',
  INIT_SEGMENT_REQUIRED: 'Initialization segment URL is required for fMP4 format',
  UPDATE_IN_PROGRESS: 'Buffer update already in progress',
  APPEND_ERROR: 'Error occurred while appending to buffer',
} as const;
