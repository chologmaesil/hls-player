declare module 'mux.js' {
  export namespace mp4 {
    class Transmuxer {
      constructor(options?: { keepOriginalTimestamps?: boolean });
      on(event: string, callback: Function): void;
      push(data: Uint8Array): void;
      flush(): void;
      dispose(): void;
    }
  }
}
