import { POLLING } from '../shared/constants';
import type { WaveformApi } from '../waveform/types';
import { fetchAndDecodeToBars } from '../waveform/audio-decoder';
import { findNativeRange, findPlayingAudio } from './dom-selectors';
import { updatePlayPauseIcon, isIconDebouncing, trackAudioEvents } from './transport-proxy';
import { showWaveformError } from './error-feedback';
import { onIdleChanged } from './lifecycle';

let cachedAudio: HTMLAudioElement | null = null;
let cachedAudioSrc: string | null = null;
let audioCheckCounter = 0;

/** Get the current audio element, with throttled re-checking. */
export function getAudio(): HTMLAudioElement | null {
  audioCheckCounter++;
  if (audioCheckCounter >= POLLING.AUDIO_CHECK_INTERVAL || !cachedAudio) {
    audioCheckCounter = 0;
    const a = findPlayingAudio();
    if (a) {
      const src = a.currentSrc || a.src;
      if (a !== cachedAudio || src !== cachedAudioSrc) {
        cachedAudio = a;
        cachedAudioSrc = src;
      }
    } else if (cachedAudio) {
      cachedAudio = null;
      cachedAudioSrc = null;
    }
  }
  if (cachedAudio && !document.body.contains(cachedAudio)) {
    cachedAudio = null;
    cachedAudioSrc = null;
  }
  return cachedAudio;
}

export function resetAudioCache(): void {
  cachedAudio = null;
  cachedAudioSrc = null;
}

/** Start the RAF polling loop that syncs waveform progress with audio playback. */
export function startPolling(
  getWaveformApi: () => WaveformApi | null,
  waveformRoot?: HTMLElement | null,
): number {
  let playPauseCheckCounter = 0;
  let lastDecodedSrc: string | null = null;
  let idleCounter = 0;
  let wasIdle = true;

  function poll(): void {
    pollRAF = requestAnimationFrame(poll);
    const waveformApi = getWaveformApi();
    if (!waveformApi) return;

    const audio = getAudio();
    trackAudioEvents(audio);
    // Only a real audio element with valid duration counts as activity
    const hasActivity = !!audio && Number.isFinite(audio.duration) && audio.duration > 0;

    if (hasActivity) {
      const ratio = audio!.currentTime / audio!.duration;
      waveformApi.setProgress(ratio);
      waveformApi.setTimeLabels(audio!.currentTime, audio!.duration);
    } else {
      const range = findNativeRange();
      if (range) {
        const val = parseFloat(range.value) || 0;
        const max = parseFloat(range.max) || 1;
        const r = max > 0 ? val / max : 0;
        waveformApi.setProgress(r);
        waveformApi.setTimeLabels(val, max);
      }
    }

    // Idle state: show/hide our bar AND native elements together
    if (hasActivity) {
      idleCounter = 0;
      if (wasIdle) {
        wasIdle = false;
        onIdleChanged(false);
      }
    } else {
      idleCounter++;
      if (idleCounter >= POLLING.IDLE_THRESHOLD && !wasIdle) {
        wasIdle = true;
        onIdleChanged(true);
      }
    }

    // Decode waveform when audio src changes
    if (audio) {
      const src = audio.currentSrc || audio.src;
      if (src && src !== lastDecodedSrc) {
        lastDecodedSrc = src;
        waveformApi.setDecoding(true);
        fetchAndDecodeToBars(src).then((bars) => {
          const api = getWaveformApi();
          if (api) api.setBars(bars);
          if (!bars && waveformRoot) {
            showWaveformError(waveformRoot, 'Could not decode audio waveform');
          }
        });
      }
    }

    // Update play/pause icon periodically (skip during debounce after user click)
    playPauseCheckCounter++;
    if (playPauseCheckCounter >= POLLING.PLAY_PAUSE_CHECK_INTERVAL) {
      playPauseCheckCounter = 0;
      if (!isIconDebouncing()) {
        updatePlayPauseIcon();
      }
    }
  }

  let pollRAF = requestAnimationFrame(poll);
  return pollRAF;
}
