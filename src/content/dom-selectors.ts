/**
 * All DOM selectors for Suno's player UI in one file.
 * When Suno changes their DOM, only this file needs updating.
 *
 * Uses multi-strategy fallback chains: if the primary selector breaks,
 * secondary and tertiary strategies attempt to find the right elements.
 */

// ─── Native Range Input ─────────────────────────────────────────

/** Find the native playback progress range input. */
export function findNativeRange(): HTMLInputElement | null {
  // Primary: aria-label based
  const primary = document.querySelector<HTMLInputElement>(
    'input[type="range"][aria-label="Playback progress"]',
  );
  if (primary) return primary;

  // Secondary: find range inside the bottom fixed bar
  const playbar = findPlaybarRootByClass();
  if (playbar) {
    const range = playbar.querySelector<HTMLInputElement>('input[type="range"]');
    if (range) return range;
  }

  return null;
}

// ─── Seeker Row ─────────────────────────────────────────────────

type SelectorStrategy<T> = {
  name: string;
  find: () => T | null;
};

const seekerRowStrategies: SelectorStrategy<HTMLElement>[] = [
  {
    name: 'aria-range-parent',
    find: () => {
      const range = document.querySelector<HTMLInputElement>(
        'input[type="range"][aria-label="Playback progress"]',
      );
      if (!range) return null;
      return walkUpToSeekerRow(range);
    },
  },
  {
    name: 'playbar-structure',
    find: () => {
      const playbar = findPlaybarRootByClass();
      if (!playbar) return null;
      const range = playbar.querySelector<HTMLInputElement>('input[type="range"]');
      if (!range) return null;
      return walkUpToSeekerRow(range);
    },
  },
  {
    name: 'time-labels-heuristic',
    find: () => {
      // Last resort: search all elements for M:SS pattern near a range input
      const ranges = document.querySelectorAll<HTMLInputElement>('input[type="range"]');
      for (let i = 0; i < ranges.length; i++) {
        const range = ranges[i]!;
        const result = walkUpToSeekerRow(range);
        if (result) return result;
      }
      return null;
    },
  },
];

function walkUpToSeekerRow(range: HTMLInputElement): HTMLElement | null {
  let el: HTMLElement | null = range.parentElement;
  for (let depth = 0; depth < 6 && el; depth++) {
    const children = el.children;
    if (children.length >= 3) {
      let hasTime = false;
      let hasTrack = false;
      for (let i = 0; i < children.length; i++) {
        const txt = (children[i]!.textContent || '').trim();
        if (/^\d{1,2}:\d{2}$/.test(txt) || txt === '--:--') hasTime = true;
        if (children[i]!.contains(range)) hasTrack = true;
      }
      if (hasTime && hasTrack) return el;
    }
    el = el.parentElement;
  }
  // Fallback: walk up 2 levels
  el = range.parentElement;
  for (let j = 0; j < 2 && el; j++) el = el.parentElement;
  return el || range.parentElement;
}

/**
 * Find the seeker row containing time labels and the range input.
 * Uses multiple strategies with automatic fallback.
 */
export function findSeekerRow(): HTMLElement | null {
  for (const strategy of seekerRowStrategies) {
    const result = strategy.find();
    if (result) return result;
  }
  return null;
}

// ─── Transport Row ──────────────────────────────────────────────

/**
 * Find the native transport controls row (shuffle/prev/play/next/repeat).
 * Strategy: find the smallest common ancestor of Prev and Next buttons.
 */
export function findTransportRow(): HTMLElement | null {
  // Primary: aria-label based
  const prev = document.querySelector<HTMLElement>(
    'button[aria-label="Playbar: Previous Song button"]',
  );
  if (!prev) return null;
  const next = document.querySelector<HTMLElement>(
    'button[aria-label="Playbar: Next Song button"]',
  );
  if (!next) return null;

  let el: HTMLElement | null = prev.parentElement;
  for (let d = 0; d < 4 && el; d++) {
    if (el.contains(next)) return el;
    el = el.parentElement;
  }
  return prev.parentElement;
}

// ─── Playbar Root ───────────────────────────────────────────────

/** Find the bottom bar by class name (no dependency on range). */
function findPlaybarRootByClass(): HTMLElement | null {
  return document.querySelector<HTMLElement>('[class*="bg-background-secondary"]');
}

/** Bottom playbar container (div.bg-background-secondary containing the range). */
export function findPlaybarRoot(): HTMLElement | null {
  const range = findNativeRange();
  if (!range) return null;
  let el: HTMLElement | null = range;
  while (el && el !== document.body) {
    if (el.className && el.className.indexOf('bg-background-secondary') !== -1) return el;
    el = el.parentElement;
  }
  // Fallback: find by class alone
  return findPlaybarRootByClass();
}

// ─── Native Buttons ─────────────────────────────────────────────

/** Find a native button by aria-label substring, optionally scoped. */
export function findNativeButton(
  labelPart: string,
  scope?: HTMLElement,
): HTMLButtonElement | null {
  const selector = `button[aria-label*="${labelPart}"]`;
  return (scope ?? document).querySelector<HTMLButtonElement>(selector);
}

// ─── Audio Element ──────────────────────────────────────────────

/** Find the currently playing (or first available) audio element. */
export function findPlayingAudio(): HTMLAudioElement | null {
  const audios = document.querySelectorAll('audio');
  let withSrc: HTMLAudioElement | null = null;
  for (let i = 0; i < audios.length; i++) {
    const a = audios[i]!;
    const src = a.currentSrc || a.src;
    if (!src || src.indexOf('sil-') !== -1) continue;
    if (!a.paused) return a;
    if (!withSrc) withSrc = a;
  }
  return withSrc;
}
