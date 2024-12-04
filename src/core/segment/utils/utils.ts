export const timeoutPromise = (ms: number, errorMessage: string) =>
  new Promise<never>((_, reject) => setTimeout(() => reject(new Error(errorMessage)), ms));
