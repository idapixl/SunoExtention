import { findPlaybarRoot, findNativeButton, findPlayingAudio } from './dom-selectors';
import { ICON_PLAY, ICON_PAUSE } from './icons';
import { ICON_DEBOUNCE_MS } from '../shared/constants';

let playPauseBtn: HTMLButtonElement | null = null;
let debounceUntil = 0;
let trackedAudio: HTMLAudioElement | null = null;

export function getPlayPauseBtn(): HTMLButtonElement | null {
  return playPauseBtn;
}

export function setPlayPauseBtn(btn: HTMLButtonElement | null): void {
  playPauseBtn = btn;
}

/** Returns true if polling should skip icon updates (user just clicked). */
export function isIconDebouncing(): boolean {
  return performance.now() < debounceUntil;
}

/** Start debounce period after a user-initiated play/pause action. */
function startDebounce(): void {
  debounceUntil = performance.now() + ICON_DEBOUNCE_MS;
}

/**
 * Find a native button by trying scoped search first, then document-wide fallback.
 */
function findNativeButtonRobust(labelPart: string): HTMLButtonElement | null {
  const playbar = findPlaybarRoot();
  if (playbar) {
    const scoped = findNativeButton(labelPart, playbar);
    if (scoped) return scoped;
  }
  return findNativeButton(labelPart);
}

/** Set the icon based on paused state. */
function applyIcon(isPaused: boolean): void {
  if (!playPauseBtn) return;
  playPauseBtn.innerHTML = isPaused ? ICON_PLAY : ICON_PAUSE;
  playPauseBtn.setAttribute('aria-label', isPaused ? 'Play' : 'Pause');
}

/**
 * Attach play/pause event listeners to the audio element for instant icon updates.
 * Called from the polling loop when the tracked audio changes.
 */
export function trackAudioEvents(audio: HTMLAudioElement | null): void {
  if (audio === trackedAudio) return;

  // Remove old listeners
  if (trackedAudio) {
    trackedAudio.removeEventListener('play', onAudioPlay);
    trackedAudio.removeEventListener('pause', onAudioPause);
    trackedAudio.removeEventListener('playing', onAudioPlay);
  }

  trackedAudio = audio;

  if (trackedAudio) {
    trackedAudio.addEventListener('play', onAudioPlay);
    trackedAudio.addEventListener('pause', onAudioPause);
    trackedAudio.addEventListener('playing', onAudioPlay);
  }
}

function onAudioPlay(): void {
  applyIcon(false);
}

function onAudioPause(): void {
  applyIcon(true);
}

/**
 * Create a proxy button that clicks a native Suno playbar button on activation.
 * Uses multi-strategy search: playbar-scoped, then document-wide.
 * For play/pause, falls back to direct audio manipulation if native button is missing.
 */
export function createProxyButton(
  className: string,
  svgHtml: string,
  ariaLabel: string,
  nativeLabelParts: string | string[],
): HTMLButtonElement {
  const parts = typeof nativeLabelParts === 'string' ? [nativeLabelParts] : nativeLabelParts;
  const isPlayPause = parts.some(
    (p) => p.indexOf('Pause') !== -1 || p.indexOf('Play') !== -1,
  );

  const btn = document.createElement('button');
  btn.className = className;
  btn.setAttribute('aria-label', ariaLabel);
  btn.type = 'button';
  btn.innerHTML = svgHtml;

  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (isPlayPause) startDebounce();

    // Try each label part with robust search
    for (let i = 0; i < parts.length; i++) {
      const native = findNativeButtonRobust(parts[i]!);
      if (native) {
        native.click();
        if (isPlayPause) {
          // Optimistic icon flip: toggle immediately
          const currentLabel = playPauseBtn?.getAttribute('aria-label') || '';
          applyIcon(currentLabel === 'Pause');
        }
        return;
      }
    }

    // Fallback for play/pause: manipulate audio directly
    if (isPlayPause) {
      const audio = findPlayingAudio();
      if (audio) {
        if (audio.paused) {
          audio.play();
          applyIcon(false);
        } else {
          audio.pause();
          applyIcon(true);
        }
      }
    }
  });
  return btn;
}

/** Update play/pause icon from the native button's state or audio element. */
export function updatePlayPauseIcon(): void {
  if (!playPauseBtn) return;

  // Strategy 1: check native button aria-label
  const native =
    findNativeButtonRobust('Pause button') || findNativeButtonRobust('Play button');
  if (native) {
    const label = native.getAttribute('aria-label') || '';
    applyIcon(label.indexOf('Play button') !== -1);
    return;
  }

  // Strategy 2: check audio element directly
  const audio = findPlayingAudio();
  if (audio) {
    applyIcon(audio.paused);
  }
}
