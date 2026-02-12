# Suno Waveform Seeker

Chrome extension that replaces the standard progress bar in Suno's bottom media player with an interactive waveform seeker on [suno.com](https://suno.com).

## Features

- Interactive waveform visualization with 200 mirrored bars
- Click or drag to seek to any position
- Inline transport controls (prev/play/next)
- Volume slider with mute toggle
- Playback speed control (0.5x - 2x)
- Loop toggle
- Keyboard shortcuts (Space, Shift+arrows, M)
- Hover tooltips showing seek time
- Settings popup to toggle controls on/off
- Smooth bar animations on track change
- Touch-friendly with full keyboard accessibility

## Development Setup

```bash
npm install
npm run build
```

This builds the extension into the `dist/` directory.

### Loading in Chrome

1. Open Chrome and go to `chrome://extensions/`
2. Turn on **Developer mode** (top right)
3. Click **Load unpacked** and select the `dist/` folder
4. Visit [suno.com/create](https://suno.com/create) and play a track

### Scripts

- `npm run build` — Build all entry points into `dist/`
- `npm run typecheck` — Run TypeScript type checking
- `npm test` — Run tests (Vitest)

### Generating Icons

The extension icon source is `assets/icons/icon.svg`. To generate PNGs:

```bash
npm install sharp   # one-time
node scripts/generate-icons.js
```

Or manually export the SVG at 16, 32, 48, and 128px.

## Architecture

```text
src/
  background/       Service worker (cross-origin audio fetch)
  content/          Content script (DOM orchestration)
    controls/       Volume, speed, loop controls
    dom-selectors   All Suno DOM queries (single-file fix point)
    lifecycle       Inject/cleanup/watchDOM
    polling         RAF-based progress sync
    transport-proxy Proxy buttons for native controls
  waveform/         Canvas waveform engine
    audio-decoder   Web Audio API decode + RMS bars
    canvas-renderer Drawing logic
    seeker-component  Component factory + interaction
  shared/           Constants, settings, messaging, formatting
  popup/            Extension popup with settings toggles
  styles/           CSS
```

## If the seeker is not replaced

Suno's DOM is not documented. The extension uses multi-strategy selectors with fallback chains. If Suno changes their markup, update the selectors in `src/content/dom-selectors.ts`.

## Keyboard Shortcuts

| Key          | Action                                       |
| ------------ | -------------------------------------------- |
| Space        | Play / Pause                                 |
| Shift + ←    | Skip back 10s                                |
| Shift + →    | Skip forward 10s                             |
| M            | Toggle mute                                  |
| ← →          | Seek ±2% (when waveform focused)             |
| Home / End   | Jump to start / end (when waveform focused)  |
