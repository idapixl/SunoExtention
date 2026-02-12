import { WAVEFORM, COLORS, LOADING } from '../shared/constants';

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  if (w <= 0 || h <= 0) return;
  if (r > w / 2) r = w / 2;
  if (r > h / 2) r = h / 2;
  if (r < 0.5 || !ctx.roundRect) {
    ctx.rect(x, y, w, h);
    return;
  }
  ctx.roundRect(x, y, w, h, r);
}

export interface DrawState {
  bars: number[] | null;
  progress: number;
  isDecoding: boolean;
  isDragging: boolean;
  dragRatio: number;
  hoverRatio: number;
  /** 0..1 global opacity for fade transitions */
  opacity: number;
}

// Pre-generated skeleton bar heights (deterministic pseudo-random)
let _skeletonBars: number[] | null = null;
function getSkeletonBars(): number[] {
  if (_skeletonBars) return _skeletonBars;
  const count = LOADING.SKELETON_BARS;
  _skeletonBars = [];
  for (let i = 0; i < count; i++) {
    const t = i / count;
    const v =
      0.15 +
      0.25 * Math.sin(t * Math.PI * 4.7) +
      0.15 * Math.sin(t * Math.PI * 11.3) +
      0.1 * Math.cos(t * Math.PI * 7.1);
    _skeletonBars.push(Math.max(0.08, Math.min(0.7, v)));
  }
  return _skeletonBars;
}

/** Draw the full waveform frame onto the canvas. */
export function drawWaveform(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  state: DrawState,
  scheduleDraw: () => void,
): void {
  if (!w || !h) return;
  ctx.clearRect(0, 0, w, h);

  const centerY = h / 2;
  const progressX = state.progress * w;
  const savedAlpha = ctx.globalAlpha;
  ctx.globalAlpha = state.opacity;

  if (state.bars && state.bars.length > 0) {
    // ─── Real waveform bars ─────────────────────────────────
    const barSlotW = w / state.bars.length;
    const barW = Math.max(1, barSlotW - WAVEFORM.BAR_GAP);

    for (let i = 0; i < state.bars.length; i++) {
      const x = i * barSlotW + WAVEFORM.BAR_GAP / 2;
      const amp = state.bars[i]!;
      const halfBarH = Math.max(WAVEFORM.MIN_BAR_H, amp * (centerY - 2));
      const barMidX = x + barW / 2;
      ctx.fillStyle = barMidX <= progressX ? COLORS.PLAYED : COLORS.UNPLAYED;

      ctx.beginPath();
      drawRoundedRect(ctx, x, centerY - halfBarH, barW, halfBarH, WAVEFORM.BAR_RADIUS);
      ctx.fill();

      ctx.beginPath();
      drawRoundedRect(ctx, x, centerY, barW, halfBarH, WAVEFORM.BAR_RADIUS);
      ctx.fill();
    }
  } else if (state.isDecoding) {
    // ─── Skeleton waveform with shimmer ─────────────────────
    drawSkeletonLoader(ctx, w, h, centerY, state.opacity);
    scheduleDraw();
  } else {
    // ─── Fallback: thin progress bar ────────────────────────
    ctx.fillStyle = COLORS.UNPLAYED;
    ctx.fillRect(0, centerY - WAVEFORM.FALLBACK_BAR_H / 2, w, WAVEFORM.FALLBACK_BAR_H);
    ctx.fillStyle = COLORS.PLAYED;
    ctx.fillRect(0, centerY - WAVEFORM.FALLBACK_BAR_H / 2, progressX, WAVEFORM.FALLBACK_BAR_H);
  }

  // Playhead line
  if (state.progress > 0 && state.progress < 1) {
    ctx.fillStyle = COLORS.PLAYHEAD;
    const phX = Math.round(progressX) - WAVEFORM.PLAYHEAD_W / 2;
    ctx.fillRect(phX, 0, WAVEFORM.PLAYHEAD_W, h);
  }

  // Drag ghost playhead
  if (state.isDragging && state.dragRatio >= 0 && state.dragRatio <= 1) {
    const gx = Math.round(state.dragRatio * w);
    ctx.fillStyle = COLORS.DRAG_GHOST;
    ctx.fillRect(gx - 1, 0, 2, h);
  }

  // Hover cursor line
  if (!state.isDragging && state.hoverRatio >= 0 && state.hoverRatio <= 1) {
    const hx = Math.round(state.hoverRatio * w);
    ctx.fillStyle = COLORS.HOVER_LINE;
    ctx.fillRect(hx - 0.5, 0, 1, h);
  }

  ctx.globalAlpha = savedAlpha;
}

/** Draw animated skeleton bars with a sweeping shimmer highlight. */
function drawSkeletonLoader(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  centerY: number,
  parentOpacity: number,
): void {
  const skeleton = getSkeletonBars();
  const barSlotW = w / skeleton.length;
  const barW = Math.max(2, barSlotW - 2);

  // Shimmer position: sweeps left to right continuously
  const now = performance.now() / 1000;
  const cycle = w + LOADING.SHIMMER_WIDTH * 2;
  const shimmerX = (now * LOADING.SHIMMER_SPEED) % cycle - LOADING.SHIMMER_WIDTH;

  for (let i = 0; i < skeleton.length; i++) {
    const x = i * barSlotW + 1;
    const amp = skeleton[i]!;
    const halfBarH = Math.max(2, amp * (centerY - 2));
    const barCenterX = x + barW / 2;

    // Shimmer: bars near the shimmer position get a brighter tint
    const dist = Math.abs(barCenterX - shimmerX);
    const shimmerFactor = Math.max(0, 1 - dist / LOADING.SHIMMER_WIDTH);
    // smoothstep
    const shimmerEase = shimmerFactor * shimmerFactor * (3 - 2 * shimmerFactor);

    if (shimmerEase > 0.01) {
      ctx.fillStyle = COLORS.LOADING_SHIMMER;
      ctx.globalAlpha = parentOpacity * (0.3 + shimmerEase * 0.7);
    } else {
      ctx.fillStyle = COLORS.LOADING_BAR;
      ctx.globalAlpha = parentOpacity;
    }

    ctx.beginPath();
    drawRoundedRect(ctx, x, centerY - halfBarH, barW, halfBarH, WAVEFORM.BAR_RADIUS);
    ctx.fill();

    ctx.beginPath();
    drawRoundedRect(ctx, x, centerY, barW, halfBarH, WAVEFORM.BAR_RADIUS);
    ctx.fill();
  }

  ctx.globalAlpha = parentOpacity;
}
