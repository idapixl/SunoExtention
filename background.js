/**
 * Background service worker for Suno Waveform Seeker.
 * Fetches cross-origin audio from cdn1/cdn2.suno.ai and relays the ArrayBuffer
 * back to the content script so it can decode the waveform.
 */

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  if (request.type === 'fetchAudioBuffer' && request.url) {
    fetch(request.url)
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.arrayBuffer();
      })
      .then(function (buffer) {
        // Convert ArrayBuffer to regular array for messaging
        var arr = Array.from(new Uint8Array(buffer));
        sendResponse({ ok: true, data: arr });
      })
      .catch(function (err) {
        sendResponse({ ok: false, error: err.message || 'Fetch failed' });
      });
    // Return true to indicate we will call sendResponse asynchronously
    return true;
  }
});
