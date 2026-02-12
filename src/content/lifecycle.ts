import type { WaveformApi } from '../waveform/types';
import { createWaveformSeeker } from '../waveform/seeker-component';
import { loadSettings, getSettings, watchSettingsChanges } from '../shared/settings';
import { findNativeRange, findSeekerRow, findTransportRow } from './dom-selectors';
import { ICON_PREV, ICON_PAUSE, ICON_NEXT } from './icons';
import { createProxyButton, setPlayPauseBtn, trackAudioEvents } from './transport-proxy';
import { startPolling, getAudio, resetAudioCache } from './polling';
import { createSpeedControl } from './controls/speed-control';
import { createLoopButton } from './controls/loop-control';
import { initKeyboardShortcuts } from './keyboard';

let waveformApi: WaveformApi | null = null;
let waveformRoot: HTMLElement | null = null;
let seekerRowRef: HTMLElement | null = null;
let transportRowRef: HTMLElement | null = null;
let pollRAF: number | null = null;
let cleanupKeyboard: (() => void) | null = null;
let isActive = false;

export function getWaveformApi(): WaveformApi | null {
  return waveformApi;
}

/** Show our bar and hide native elements. */
function activate(): void {
  if (isActive) return;
  isActive = true;
  if (waveformRoot) waveformRoot.style.display = '';
  if (seekerRowRef) seekerRowRef.classList.add('suno-wf-hidden');
  if (transportRowRef) transportRowRef.classList.add('suno-wf-hidden-transport');
}

/** Hide our bar and restore native elements. */
function deactivate(): void {
  if (!isActive) return;
  isActive = false;
  if (waveformRoot) waveformRoot.style.display = 'none';
  if (seekerRowRef) seekerRowRef.classList.remove('suno-wf-hidden');
  if (transportRowRef) transportRowRef.classList.remove('suno-wf-hidden-transport');
}

/** Called by polling when idle state changes. */
export function onIdleChanged(idle: boolean): void {
  if (idle) {
    deactivate();
  } else {
    activate();
  }
}

function cleanup(): void {
  if (pollRAF) {
    cancelAnimationFrame(pollRAF);
    pollRAF = null;
  }
  if (waveformApi) {
    waveformApi.destroy();
    waveformApi = null;
  }
  // Restore native elements
  deactivate();
  if (seekerRowRef) {
    seekerRowRef.removeAttribute('data-suno-wf');
    seekerRowRef = null;
  }
  transportRowRef = null;
  if (cleanupKeyboard) {
    cleanupKeyboard();
    cleanupKeyboard = null;
  }
  waveformRoot = null;
  resetAudioCache();
  trackAudioEvents(null);
  setPlayPauseBtn(null);
}

function inject(): boolean {
  const seekerRow = findSeekerRow();
  if (!seekerRow || seekerRow.getAttribute('data-suno-wf') === 'done') return true;

  // Mark as processed but DON'T hide native elements yet — wait for audio
  seekerRow.setAttribute('data-suno-wf', 'done');
  seekerRowRef = seekerRow;
  transportRowRef = findTransportRow();

  const settings = getSettings();

  // Build root: [prev] [play] [next] | [time] [waveform] [time] | [speed] [loop]
  const root = document.createElement('div');
  root.className = 'suno-wf-seeker-root';
  root.style.display = 'none'; // Hidden until audio is detected

  // Transport buttons
  const transportGroup = document.createElement('div');
  transportGroup.className = 'suno-wf-transport';

  const prevBtn = createProxyButton('suno-wf-btn suno-wf-btn-sm', ICON_PREV, 'Previous', 'Previous');
  const playPauseButton = createProxyButton(
    'suno-wf-btn suno-wf-btn-play',
    ICON_PAUSE,
    'Pause',
    ['Pause button', 'Play button'],
  );
  setPlayPauseBtn(playPauseButton);
  const nextBtn = createProxyButton('suno-wf-btn suno-wf-btn-sm', ICON_NEXT, 'Next', 'Next');

  transportGroup.appendChild(prevBtn);
  transportGroup.appendChild(playPauseButton);
  transportGroup.appendChild(nextBtn);
  root.appendChild(transportGroup);

  seekerRow.parentNode!.insertBefore(root, seekerRow);
  waveformRoot = root;

  // Create waveform (appends time + canvas + time + tooltip into root)
  waveformApi = createWaveformSeeker(root);

  // Right-side controls
  const controls = document.createElement('div');
  controls.className = 'suno-wf-controls-right';

  if (settings.showSpeed) {
    controls.appendChild(createSpeedControl(getAudio));
  }
  if (settings.showLoop) {
    controls.appendChild(createLoopButton(getAudio));
  }

  if (controls.children.length > 0) {
    root.appendChild(controls);
  }

  // Seek handler
  waveformApi.onSeek((ratio) => {
    const audio = getAudio();
    if (audio && Number.isFinite(audio.duration) && audio.duration > 0) {
      audio.currentTime = ratio * audio.duration;
    }
    const range = findNativeRange();
    if (range) {
      const max = parseFloat(range.max) || 1;
      const nativeSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value',
      )!.set!;
      nativeSetter.call(range, String(ratio * max));
      range.dispatchEvent(new Event('input', { bubbles: true }));
      range.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });

  // Keyboard shortcuts
  if (settings.keyboardShortcuts) {
    cleanupKeyboard = initKeyboardShortcuts(getAudio);
  }

  pollRAF = startPolling(() => waveformApi, waveformRoot);
  return true;
}

let observer: MutationObserver | null = null;

function watchDOM(): void {
  if (observer) return;
  observer = new MutationObserver(() => {
    if (waveformRoot && !document.body.contains(waveformRoot)) {
      cleanup();
    }
    if (!waveformRoot && findNativeRange()) {
      inject();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

export async function init(): Promise<void> {
  // Load settings before injecting so controls are configured
  await loadSettings();

  // Re-inject when settings change from popup/options
  watchSettingsChanges(() => {
    if (waveformRoot) {
      cleanup();
      inject();
    }
  });

  if (findNativeRange()) inject();
  watchDOM();
}
