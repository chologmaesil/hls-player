export type SegmentLoadOptions = {
  timeout?: number; // 세그먼트 로드 타임아웃 시간
  retryCount?: number; // 재시도 횟수
};

export type SegmentLoadResult = {
  data: ArrayBuffer; // 세그먼트 데이터
  duration: number; // 세그먼트 지속 시간
  sequence: number; // 세그먼트 시퀀스 번호
};
