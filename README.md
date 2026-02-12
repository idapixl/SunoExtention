# Suno Waveform Seeker

[![Chrome Web Store](https://img.shields.io/badge/Chrome_Web_Store-Install-blue?logo=googlechrome)](https://chromewebstore.google.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

A Chrome extension that replaces Suno's default progress bar with an interactive waveform visualizer. Seek to any position, control playback speed, loop tracks, and use keyboard shortcuts — all from a sleek dark-themed UI that blends right into suno.com.

## Features

- **Interactive waveform** — Canvas-rendered bars decoded from the actual audio
- **Click-to-seek** — Click or drag anywhere on the waveform to jump to that position
- **Playback speed** — Cycle through 0.5x, 0.75x, 1x, 1.25x, 1.5x, 2x
- **Loop toggle** — Repeat the current track with one click
- **Keyboard shortcuts** — Hands-free control (see below)
- **Hover tooltip** — See the exact timestamp at your cursor position
- **Loading animation** — Animated skeleton shimmer while the waveform decodes
- **Smooth transitions** — Fade animations when switching between songs
- **Transport controls** — Previous, play/pause, and next buttons integrated into the waveform bar
- **Dark theme** — Matches Suno's UI seamlessly
- **Popup settings** — Toggle any feature on or off

## Keyboard Shortcuts

| Key                    | Action              |
| ---------------------- | ------------------- |
| `Space` | Play / Pause |
| `Shift + Left Arrow` | Skip back 10 seconds |
| `Shift + Right Arrow` | Skip forward 10 seconds |
| `M` | Mute / Unmute |

## Install

### Chrome Web Store

Coming soon.

### Manual (Developer Mode)

1. Clone this repo
2. Install dependencies and build:

   ```bash
   npm install
   npm run build
   ```

3. Open `chrome://extensions/` in Chrome
4. Enable **Developer mode** (top-right toggle)
5. Click **Load unpacked** and select the `dist/` folder
6. Navigate to [suno.com](https://suno.com) and play a track

## Development

### Prerequisites

- Node.js 18+
- npm

### Setup

```bash
git clone https://github.com/IDAPIXL/suno-waveform-seeker.git
cd suno-waveform-seeker
npm install
```

### Scripts

| Command              | Description                |
| -------------------- | -------------------------- |
| `npm run build` | Build extension to `dist/` |
| `npm run typecheck` | Run TypeScript type checking |
| `npm test` | Run tests |
| `npm run test:watch` | Run tests in watch mode |

### Generating Icons

The extension icon source is `assets/icons/icon.svg`. To generate PNGs:

```bash
npm install sharp   # one-time
node scripts/generate-icons.js
```

Or manually export the SVG at 16, 32, 48, and 128px.

### Project Structure

```text
src/
  manifest.json          # Chrome extension manifest (MV3)
  background/            # Service worker (audio fetching)
  content/               # Content script modules
    controls/            # Speed, loop controls
    dom-selectors.ts     # All DOM queries (single fix-point)
    keyboard.ts          # Global keyboard shortcuts
    lifecycle.ts         # Inject/cleanup/show/hide orchestration
    polling.ts           # RAF loop syncing waveform with audio
    transport-proxy.ts   # Proxy play/pause/prev/next buttons
  waveform/              # Waveform rendering
    audio-decoder.ts     # AudioContext decode + RMS bars
    canvas-renderer.ts   # Canvas 2D drawing + skeleton loader
    seeker-component.ts  # Waveform seeker factory
  shared/                # Shared utilities
    constants.ts         # All magic numbers, named
    format.ts            # Time formatting
    messaging.ts         # Typed Chrome message contracts
    settings.ts          # chrome.storage.sync + in-memory cache
  styles/
    content.css          # Injected styles
  popup/                 # Extension popup page
scripts/
  build.js               # Vite multi-entry build script
  generate-icons.js      # Icon generation utility
```

### Architecture

The extension uses **Vite** to bundle TypeScript into IIFE-format scripts (Chrome MV3 content scripts can't use ES modules). Three separate builds produce `content.js`, `background.js`, and `popup.js`.

**Content script** injects a custom waveform bar into Suno's playbar. A `requestAnimationFrame` polling loop syncs waveform progress with the active `<audio>` element. When a new song starts, the audio is decoded via the Web Audio API to generate RMS amplitude bars.

**Service worker** handles cross-origin audio fetching for waveform decoding (Suno's CDN requires the extension's host permissions).

## If the Seeker Is Not Replaced

Suno's DOM is not documented. The extension uses multi-strategy selectors with fallback chains. If Suno changes their markup, update the selectors in `src/content/dom-selectors.ts`.

## Privacy

- No data collection, analytics, or tracking
- No external requests except to Suno's own audio CDN for waveform decoding
- All processing happens locally in your browser
- Only activates on suno.com

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## Support

If you find this extension useful, consider [sponsoring the project](https://github.com/sponsors/IDAPIXL).

## License

[MIT](LICENSE)
