import { WAVEFORM } from '../shared/constants';
import { sendFetchAudio } from '../shared/messaging';

let sharedAudioCtx: AudioContext | null = null;
let closeTimer: ReturnType<typeof setTimeout> | null = null;
const IDLE_TIMEOUT_MS = 30_000;

function getAudioCtx(): AudioContext {
  // Cancel any pending close
  if (closeTimer) {
    clearTimeout(closeTimer);
    closeTimer = null;
  }
  if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
    sharedAudioCtx = new AudioContext();
  }
  return sharedAudioCtx;
}

/** Schedule closing the AudioContext after inactivity to free system audio resources. */
function scheduleContextClose(): void {
  if (closeTimer) clearTimeout(closeTimer);
  closeTimer = setTimeout(() => {
    sharedAudioCtx?.close();
    sharedAudioCtx = null;
    closeTimer = null;
  }, IDLE_TIMEOUT_MS);
}

function decodeBuffer(arrayBuffer: ArrayBuffer): Promise<Float32Array[] | null> {
  try {
    const ctx = getAudioCtx();
    return new Promise((resolve) => {
      ctx.decodeAudioData(
        arrayBuffer,
        (decoded) => {
          const channels: Float32Array[] = [];
          for (let i = 0; i < decoded.numberOfChannels; i++) {
            channels.push(decoded.getChannelData(i));
          }
          scheduleContextClose();
          resolve(channels);
        },
        () => {
          scheduleContextClose();
          resolve(null);
        },
      );
    });
  } catch {
    return Promise.resolve(null);
  }
}

/**
 * Merge channels into bars using RMS (root-mean-square) for smoother look.
 * Exported for testing.
 */
export function mergeChannelsToBars(
  channels: Float32Array[] | null,
  numBars: number,
): number[] | null {
  if (!channels || !channels.length) return null;
  const firstChannel = channels[0];
  if (!firstChannel) return null;

  const len = firstChannel.length;
  const blockSize = len / numBars;
  const bars: number[] = [];

  for (let i = 0; i < numBars; i++) {
    const start = Math.floor(i * blockSize);
    const end = Math.min(Math.floor((i + 1) * blockSize), len);
    let sumSq = 0;
    let count = 0;
    for (let s = start; s < end; s++) {
      for (let c = 0; c < channels.length; c++) {
        const v = channels[c]![s]!;
        sumSq += v * v;
        count++;
      }
    }
    const rms = count > 0 ? Math.sqrt(sumSq / count) : 0;
    bars.push(Math.min(1, rms * WAVEFORM.RMS_BOOST));
  }
  return bars;
}

/** Fetch audio via background worker, decode, and return waveform bars. */
export function fetchAndDecodeToBars(url: string): Promise<number[] | null> {
  if (!url) return Promise.resolve(null);

  return sendFetchAudio(url)
    .then((buf) => {
      if (buf) return buf;
      // Fallback: direct fetch with CORS
      return fetch(url, { mode: 'cors' })
        .then((r) => (r.ok ? r.arrayBuffer() : null))
        .catch(() => null);
    })
    .then((buf) => (buf ? decodeBuffer(buf) : null))
    .then((channels) => mergeChannelsToBars(channels, WAVEFORM.NUM_BARS));
}
