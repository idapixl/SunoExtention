import { findPlaybarRoot, findNativeButton, findPlayingAudio } from './dom-selectors';
import { updatePlayPauseIcon } from './transport-proxy';

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

/**
 * Global keyboard shortcuts for playback control.
 * Uses capture phase to fire before Suno's own handlers can stop propagation.
 * Play/pause clicks native Suno buttons to keep React state in sync,
 * with direct audio fallback.
 */
export function initKeyboardShortcuts(
  getAudio: () => HTMLAudioElement | null,
): () => void {
  function handler(e: KeyboardEvent): void {
    // Don't intercept when user is typing
    const target = e.target as HTMLElement | null;
    if (!target) return;
    const tag = target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable) return;

    switch (e.key) {
      case ' ': {
        e.preventDefault();
        e.stopImmediatePropagation();
        // Try native button first
        const pauseBtn = findNativeButtonRobust('Pause button');
        const playBtn = findNativeButtonRobust('Play button');
        const nativeBtn = pauseBtn || playBtn;
        if (nativeBtn) {
          nativeBtn.click();
          setTimeout(updatePlayPauseIcon, 80);
        } else {
          // Fallback: direct audio manipulation
          const audio = getAudio() || findPlayingAudio();
          if (audio) {
            if (audio.paused) {
              audio.play();
            } else {
              audio.pause();
            }
            setTimeout(updatePlayPauseIcon, 80);
          }
        }
        break;
      }
      case 'ArrowLeft': {
        if (e.shiftKey) {
          e.preventDefault();
          e.stopImmediatePropagation();
          const audio = getAudio() || findPlayingAudio();
          if (audio) {
            audio.currentTime = Math.max(0, audio.currentTime - 10);
          }
        }
        break;
      }
      case 'ArrowRight': {
        if (e.shiftKey) {
          e.preventDefault();
          e.stopImmediatePropagation();
          const audio = getAudio() || findPlayingAudio();
          if (audio) {
            audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + 10);
          }
        }
        break;
      }
      case 'm':
      case 'M': {
        e.stopImmediatePropagation();
        const audio = getAudio() || findPlayingAudio();
        if (audio) {
          audio.muted = !audio.muted;
        }
        break;
      }
    }
  }

  // Capture phase fires before Suno's handlers can stopPropagation
  document.addEventListener('keydown', handler, true);
  return () => document.removeEventListener('keydown', handler, true);
}
