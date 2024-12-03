export function createBaseUrl(manifestUrl: string): string {
  const urlObject = new URL(manifestUrl);
  const urlParts = urlObject.pathname.split('/');
  urlParts.pop();
  return `${urlObject.protocol}//${urlObject.host}${urlParts.join('/')}/`;
}

export function resolveUrl(uri: string, baseUrl: string): string {
  return new URL(uri, baseUrl).toString();
}
