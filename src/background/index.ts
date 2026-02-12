/**
 * Background service worker for Suno Waveform Seeker.
 * Fetches cross-origin audio from cdn1/cdn2.suno.ai and relays
 * the data as base64 back to the content script for waveform decoding.
 *
 * Base64 encoding has ~33% overhead vs the previous approach of
 * Array.from(Uint8Array) which had ~300% overhead.
 */

import type { FetchAudioRequest, FetchAudioResponse } from '../shared/messaging';

/** Convert ArrayBuffer to base64 string. */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

chrome.runtime.onMessage.addListener(
  (request: FetchAudioRequest, _sender, sendResponse: (response: FetchAudioResponse) => void) => {
    if (request.type !== 'fetchAudioBuffer' || !request.url) return false;

    fetch(request.url)
      .then((res) => {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.arrayBuffer();
      })
      .then((buffer) => {
        sendResponse({ ok: true, data: arrayBufferToBase64(buffer), encoding: 'base64' });
      })
      .catch((err: Error) => {
        sendResponse({ ok: false, error: err.message || 'Fetch failed' });
      });

    return true; // async sendResponse
  },
);
