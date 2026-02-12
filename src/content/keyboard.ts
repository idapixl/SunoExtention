import { findPlayingAudio } from './dom-selectors';

/**
 * Global keyboard shortcuts for playback control.
 * Uses capture phase to fire before Suno's own handlers can stop propagation.
 * Play/pause uses direct audio manipulation for reliability.
 * Suno's native play button handles its own icon updates via React.
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
        const audio = getAudio() || findPlayingAudio();
        if (audio) {
          if (audio.paused) {
            audio.play();
          } else {
            audio.pause();
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
