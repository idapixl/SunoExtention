const ICON_LOOP =
  '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8.5a4 4 0 0 1 4-4h3"/><polyline points="8.5,2.5 10.5,4.5 8.5,6.5"/><path d="M13 7.5a4 4 0 0 1-4 4H6"/><polyline points="7.5,13.5 5.5,11.5 7.5,9.5"/></svg>';

export function createLoopButton(
  getAudio: () => HTMLAudioElement | null,
): HTMLButtonElement {
  let looping = false;

  const btn = document.createElement('button');
  btn.className = 'suno-wf-btn suno-wf-btn-sm suno-wf-loop-btn';
  btn.setAttribute('aria-label', 'Toggle loop');
  btn.type = 'button';
  btn.innerHTML = ICON_LOOP;

  btn.addEventListener('click', () => {
    looping = !looping;
    const audio = getAudio();
    if (audio) audio.loop = looping;
    btn.classList.toggle('suno-wf-loop-active', looping);
  });

  return btn;
}
