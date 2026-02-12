/**
 * Suno Waveform Seeker – content script entry point.
 *
 * Replaces the native seeker on suno.com with an interactive waveform.
 */

import { init } from './lifecycle';

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
