const AUTO_DISMISS_MS = 5000;

/** Show a subtle, auto-dismissing error message overlaid on the waveform container. */
export function showWaveformError(container: HTMLElement, message: string): void {
  const existing = container.querySelector('.suno-wf-error');
  if (existing) existing.remove();

  const el = document.createElement('div');
  el.className = 'suno-wf-error';
  el.textContent = message;
  container.appendChild(el);

  setTimeout(() => el.remove(), AUTO_DISMISS_MS);
}
