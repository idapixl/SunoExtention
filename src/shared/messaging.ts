/** Background <-> Content script message types */

export interface FetchAudioRequest {
  type: 'fetchAudioBuffer';
  url: string;
}

export interface FetchAudioResponseOk {
  ok: true;
  data: string; // base64-encoded audio data
  encoding: 'base64';
}

export interface FetchAudioResponseError {
  ok: false;
  error: string;
}

export type FetchAudioResponse = FetchAudioResponseOk | FetchAudioResponseError;

/** Decode a base64 string to an ArrayBuffer. */
function decodeBase64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/** Send a fetch request to the background service worker and return the ArrayBuffer, or null on failure. */
export function sendFetchAudio(url: string): Promise<ArrayBuffer | null> {
  return new Promise<ArrayBuffer | null>((resolve) => {
    if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
      resolve(null);
      return;
    }
    try {
      chrome.runtime.sendMessage(
        { type: 'fetchAudioBuffer', url } satisfies FetchAudioRequest,
        (response: FetchAudioResponse | undefined) => {
          if (chrome.runtime.lastError || !response || !response.ok) {
            resolve(null);
            return;
          }
          try {
            resolve(decodeBase64ToArrayBuffer(response.data));
          } catch {
            resolve(null);
          }
        },
      );
    } catch {
      resolve(null);
    }
  });
}
