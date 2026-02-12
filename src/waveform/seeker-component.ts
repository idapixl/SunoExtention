import { WAVEFORM, POLLING, LOADING } from '../shared/constants';
import { formatTime } from '../shared/format';
import { drawWaveform, type DrawState } from './canvas-renderer';
import type { WaveformApi, SeekCallback } from './types';

/**
 * Create the waveform seeker UI component.
 * Appends time labels, canvas container, and tooltip into `containerEl`.
 */
export function createWaveformSeeker(containerEl: HTMLElement): WaveformApi {
  let bars: number[] | null = null;
  let targetBars: number[] | null = null;
  let animatingBars = false;
  let progress = 0;
  let totalDuration = 0;
  let onSeekCb: SeekCallback | null = null;
  let hoverRatio = -1;
  let dragRatio = -1;
  let isDragging = false;
  let isDecoding = false;
  let drawScheduled = false;

  // Opacity for fade transitions
  let opacity = 0;
  let opacityTarget = 0;
  let fadeStartTime = 0;
  let fadeDuration = 0;
  let fadeFrom = 0;
  let isFading = false;

  // ─── DOM ──────────────────────────────────────────────────────
  const canvas = document.createElement('canvas');
  canvas.className = 'suno-wf-seeker-canvas';
  const ctx = canvas.getContext('2d')!;

  const currentTimeEl = document.createElement('span');
  currentTimeEl.className = 'suno-wf-seeker-time suno-wf-seeker-time-current';
  currentTimeEl.textContent = '0:00';

  const totalTimeEl = document.createElement('span');
  totalTimeEl.className = 'suno-wf-seeker-time suno-wf-seeker-time-total';
  totalTimeEl.textContent = '0:00';

  const hoverTooltip = document.createElement('div');
  hoverTooltip.className = 'suno-wf-hover-tooltip';
  hoverTooltip.textContent = '0:00';

  const containerDiv = document.createElement('div');
  containerDiv.className = 'suno-wf-seeker-container';
  containerDiv.tabIndex = 0;
  containerDiv.setAttribute('role', 'slider');
  containerDiv.setAttribute('aria-label', 'Waveform seeker');
  containerDiv.setAttribute('aria-valuemin', '0');
  containerDiv.setAttribute('aria-valuemax', '100');
  containerDiv.setAttribute('aria-valuenow', '0');
  containerDiv.appendChild(canvas);

  containerEl.appendChild(currentTimeEl);
  containerEl.appendChild(containerDiv);
  containerEl.appendChild(totalTimeEl);
  containerEl.appendChild(hoverTooltip);

  const wrapper = containerDiv;
  let resizeRAF: number | null = null;
  let logicalWidth = 0;
  let logicalHeight = 0;

  // ─── Fade helpers ──────────────────────────────────────────
  function startFade(target: number, durationMs: number): void {
    fadeFrom = opacity;
    opacityTarget = target;
    fadeDuration = durationMs;
    fadeStartTime = performance.now();
    isFading = true;
    scheduleDraw();
  }

  function tickFade(): void {
    if (!isFading) return;
    const elapsed = performance.now() - fadeStartTime;
    const t = Math.min(1, elapsed / fadeDuration);
    // ease-out
    const ease = 1 - (1 - t) * (1 - t);
    opacity = fadeFrom + (opacityTarget - fadeFrom) * ease;
    if (t >= 1) {
      opacity = opacityTarget;
      isFading = false;
    }
  }

  // ─── Batched drawing ──────────────────────────────────────────
  function scheduleDraw(): void {
    if (drawScheduled) return;
    drawScheduled = true;
    requestAnimationFrame(() => {
      drawScheduled = false;
      draw();
    });
  }

  // ─── Event helpers ────────────────────────────────────────────
  function getRatioFromEvent(e: MouseEvent | TouchEvent): number {
    const rect = wrapper.getBoundingClientRect();
    const clientX =
      'clientX' in e
        ? e.clientX
        : e.touches?.[0]
          ? e.touches[0].clientX
          : 0;
    const x = clientX - rect.left;
    const w = rect.width;
    if (w <= 0) return 0;
    const r = x / w;
    return r < 0 ? 0 : r > 1 ? 1 : r;
  }

  function handleSeek(ratio: number): void {
    if (onSeekCb) onSeekCb(ratio);
  }

  function onPointerDown(e: MouseEvent | TouchEvent): void {
    e.preventDefault();
    e.stopPropagation();
    isDragging = true;
    const ratio = getRatioFromEvent(e);
    dragRatio = ratio;
    handleSeek(ratio);
    scheduleDraw();

    function onMove(ev: MouseEvent | TouchEvent): void {
      ev.preventDefault();
      const r = getRatioFromEvent(ev);
      dragRatio = r;
      handleSeek(r);
      scheduleDraw();
    }
    function onUp(): void {
      isDragging = false;
      dragRatio = -1;
      scheduleDraw();
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onUp);
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onUp);
  }

  containerDiv.addEventListener('keydown', (e: KeyboardEvent) => {
    const step = POLLING.SEEK_STEP;
    if (e.key === 'ArrowLeft' || e.key === 'Home') {
      e.preventDefault();
      handleSeek(e.key === 'Home' ? 0 : Math.max(0, progress - step));
    } else if (e.key === 'ArrowRight' || e.key === 'End') {
      e.preventDefault();
      handleSeek(e.key === 'End' ? 1 : Math.min(1, progress + step));
    }
  });

  containerDiv.addEventListener('mousedown', onPointerDown);
  containerDiv.addEventListener('touchstart', onPointerDown, { passive: false });

  // ─── Hover tracking ───────────────────────────────────────────
  containerDiv.addEventListener('mousemove', (e: MouseEvent) => {
    const rect = wrapper.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const w = rect.width;
    if (w <= 0) {
      hoverRatio = -1;
      return;
    }
    hoverRatio = Math.max(0, Math.min(1, x / w));

    const rootRect = containerEl.getBoundingClientRect();
    hoverTooltip.textContent = formatTime(hoverRatio * totalDuration);
    hoverTooltip.classList.add('suno-wf-hover-tooltip--visible');

    const tooltipW = hoverTooltip.offsetWidth || 36;
    const absX = rect.left - rootRect.left + x;
    let leftPx = absX - tooltipW / 2;
    if (leftPx < 0) leftPx = 0;
    const maxLeft = rootRect.width - tooltipW;
    if (leftPx > maxLeft) leftPx = maxLeft;
    hoverTooltip.style.left = leftPx + 'px';

    scheduleDraw();
  });

  containerDiv.addEventListener('mouseleave', () => {
    hoverRatio = -1;
    hoverTooltip.classList.remove('suno-wf-hover-tooltip--visible');
    scheduleDraw();
  });

  // ─── Drawing ──────────────────────────────────────────────────
  function draw(): void {
    tickFade();
    const state: DrawState = {
      bars,
      progress,
      isDecoding,
      isDragging,
      dragRatio,
      hoverRatio,
      opacity,
    };
    drawWaveform(ctx, logicalWidth, logicalHeight, state, scheduleDraw);
    if (isFading) scheduleDraw();
  }

  // ─── Bar transition animation ─────────────────────────────────
  function animateBarsIn(newBars: number[]): void {
    if (!bars || bars.length !== newBars.length) {
      bars = newBars;
      // Fade in with the new bars
      startFade(1, LOADING.FADE_IN_MS);
      return;
    }
    targetBars = newBars;
    animatingBars = true;
    const startBars = bars.slice();
    const startTime = performance.now();
    const duration = WAVEFORM.BAR_TRANSITION_MS;

    function step(now: number): void {
      const t = Math.min(1, (now - startTime) / duration);
      const ease = 1 - (1 - t) * (1 - t);
      const current: number[] = [];
      for (let i = 0; i < newBars.length; i++) {
        const from = i < startBars.length ? startBars[i]! : 0;
        current.push(from + (newBars[i]! - from) * ease);
      }
      bars = current;
      scheduleDraw();
      if (t < 1) {
        requestAnimationFrame(step);
      } else {
        bars = newBars;
        targetBars = null;
        animatingBars = false;
        scheduleDraw();
      }
    }
    // Also ensure we're fading in if we were faded out
    if (opacity < 1) startFade(1, LOADING.FADE_IN_MS);
    requestAnimationFrame(step);
  }

  // ─── Resize handling ──────────────────────────────────────────
  function resize(): void {
    const dpr = window.devicePixelRatio || 1;
    const rect = wrapper.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    if (w <= 0 || h <= 0) return;
    logicalWidth = w;
    logicalHeight = h;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    draw();
  }

  let resizeObserver: ResizeObserver | null = null;
  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => {
      if (resizeRAF) cancelAnimationFrame(resizeRAF);
      resizeRAF = requestAnimationFrame(() => {
        resizeRAF = null;
        resize();
      });
    });
    resizeObserver.observe(wrapper);
  }

  function onWindowResize(): void {
    if (resizeRAF) cancelAnimationFrame(resizeRAF);
    resizeRAF = requestAnimationFrame(() => {
      resizeRAF = null;
      resize();
    });
  }
  window.addEventListener('resize', onWindowResize);
  resize();

  // ─── Public API ───────────────────────────────────────────────
  return {
    setProgress(ratio: number): void {
      const clamped = ratio < 0 ? 0 : ratio > 1 ? 1 : ratio;
      if (clamped === progress) return;
      progress = clamped;
      containerDiv.setAttribute('aria-valuenow', String(Math.round(progress * 100)));
      scheduleDraw();
    },
    setBars(newBars: number[] | null): void {
      isDecoding = false;
      if (newBars) {
        animateBarsIn(newBars);
      } else {
        bars = null;
        scheduleDraw();
      }
    },
    setDecoding(val: boolean): void {
      if (val && !isDecoding) {
        // Song is changing: fade out old bars, then show loader
        if (bars) {
          startFade(0, LOADING.FADE_OUT_MS);
          // After fade-out, clear bars so the skeleton shows
          setTimeout(() => {
            bars = null;
            isDecoding = true;
            startFade(1, LOADING.FADE_IN_MS);
          }, LOADING.FADE_OUT_MS);
        } else {
          isDecoding = true;
          startFade(1, LOADING.FADE_IN_MS);
        }
      } else {
        isDecoding = !!val;
      }
      scheduleDraw();
    },
    onSeek(cb: SeekCallback): void {
      onSeekCb = cb;
    },
    setTimeLabels(currentSeconds: number, totalSeconds: number): void {
      const ct = formatTime(currentSeconds);
      const tt = formatTime(totalSeconds);
      if (currentTimeEl.textContent !== ct) currentTimeEl.textContent = ct;
      if (totalTimeEl.textContent !== tt) totalTimeEl.textContent = tt;
      totalDuration = totalSeconds || 0;
    },
    destroy(): void {
      if (resizeObserver && wrapper) resizeObserver.unobserve(wrapper);
      window.removeEventListener('resize', onWindowResize);
      if (resizeRAF) cancelAnimationFrame(resizeRAF);
      containerDiv.removeEventListener('mousedown', onPointerDown);
      containerDiv.removeEventListener('touchstart', onPointerDown);
      if (containerEl.parentNode) {
        containerEl.parentNode.removeChild(containerEl);
      }
    },
  };
}
