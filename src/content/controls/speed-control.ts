const SPEED_OPTIONS = [1, 1.25, 1.5, 2, 0.5, 0.75] as const;

export function createSpeedControl(
  getAudio: () => HTMLAudioElement | null,
): HTMLButtonElement {
  let currentIndex = 0;

  const btn = document.createElement('button');
  btn.className = 'suno-wf-btn suno-wf-speed-btn';
  btn.setAttribute('aria-label', 'Playback speed');
  btn.type = 'button';
  btn.textContent = '1x';

  btn.addEventListener('click', () => {
    currentIndex = (currentIndex + 1) % SPEED_OPTIONS.length;
    const speed = SPEED_OPTIONS[currentIndex]!;
    const audio = getAudio();
    if (audio) audio.playbackRate = speed;
    btn.textContent = speed === 1 ? '1x' : `${speed}x`;
  });

  return btn;
}
