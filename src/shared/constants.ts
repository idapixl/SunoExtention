/** Visual configuration for waveform rendering */
export const WAVEFORM = {
  NUM_BARS: 200,
  BAR_GAP: 1,
  MIN_BAR_H: 1,
  BAR_RADIUS: 1,
  PLAYHEAD_W: 1.5,
  FALLBACK_BAR_H: 2,
  RMS_BOOST: 2.5,
  BAR_TRANSITION_MS: 400,
} as const;

/** Color palette */
export const COLORS = {
  UNPLAYED: 'rgba(255, 255, 255, 0.18)',
  PLAYED: 'rgba(120, 220, 232, 0.9)',
  PLAYHEAD: '#ffffff',
  HOVER_LINE: 'rgba(255, 255, 255, 0.4)',
  DRAG_GHOST: 'rgba(120, 220, 232, 0.45)',
  LOADING_BAR: 'rgba(255, 255, 255, 0.08)',
  LOADING_SHIMMER: 'rgba(120, 220, 232, 0.25)',
} as const;

/** Polling intervals (in RAF frames) */
export const POLLING = {
  /** Re-check for <audio> element every N frames (~500ms at 60fps) */
  AUDIO_CHECK_INTERVAL: 30,
  /** Update play/pause icon every N frames (~167ms at 60fps) */
  PLAY_PAUSE_CHECK_INTERVAL: 10,
  /** Arrow key seek step (2% of duration) */
  SEEK_STEP: 0.02,
  /** Frames with no audio before entering idle state */
  IDLE_THRESHOLD: 120,
} as const;

/** Loading/transition animation config */
export const LOADING = {
  /** Skeleton bar count (fewer than real bars for visual distinction) */
  SKELETON_BARS: 60,
  /** Shimmer sweep speed (pixels per second) */
  SHIMMER_SPEED: 200,
  /** Shimmer band width in pixels */
  SHIMMER_WIDTH: 120,
  /** Fade-out duration when transitioning songs (ms) */
  FADE_OUT_MS: 250,
  /** Fade-in duration when new bars arrive (ms) */
  FADE_IN_MS: 350,
} as const;

/** Play/pause icon update debounce after user clicks (ms) */
export const ICON_DEBOUNCE_MS = 350;
