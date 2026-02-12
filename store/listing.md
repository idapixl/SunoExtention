# Chrome Web Store Listing

## Name
Suno Waveform Seeker - Audio Visualizer

## Short Description (132 chars max)
Replaces Suno's progress bar with an interactive waveform visualizer. Adds speed control, loop, keyboard shortcuts, and seeking.

## Category
Entertainment

## Detailed Description

Enhance your Suno music experience with a real-time waveform visualizer that replaces the default progress bar on suno.com.

FEATURES

- Interactive waveform display decoded from the actual audio
- Click or drag anywhere on the waveform to seek to any position
- Playback speed control (0.5x, 0.75x, 1x, 1.25x, 1.5x, 2x)
- Loop toggle for repeating your favorite tracks
- Keyboard shortcuts for hands-free control
- Hover tooltip showing exact timestamp at cursor position
- Animated loading skeleton while waveform decodes
- Integrated transport controls (previous, play/pause, next)
- Dark theme that blends seamlessly with Suno's UI
- All features toggleable from the popup settings panel

KEYBOARD SHORTCUTS

- Space: Play / Pause
- Shift + Left Arrow: Skip back 10 seconds
- Shift + Right Arrow: Skip forward 10 seconds
- M: Mute / Unmute

HOW IT WORKS

The extension automatically detects when you play a song on suno.com and replaces the native seeker with a canvas-rendered waveform. Audio is decoded in the background to generate accurate waveform bars representing the actual audio content. Transport controls, speed, and loop sync directly with Suno's player so everything stays in sync.

The waveform only appears when a song is actively playing. When no song is selected, Suno's native player controls remain fully visible and functional.

PRIVACY

No data collection. No analytics. No tracking. No external requests except to Suno's own audio CDN for waveform decoding. All processing happens locally in your browser. The extension only activates on suno.com.

Permissions explained:
- Storage: saves your settings (speed, loop, keyboard shortcut preferences)
- Host permissions (cdn1.suno.ai, cdn2.suno.ai): required to fetch audio data for waveform generation

OPEN SOURCE

This extension is free and open source. Bug reports and feature requests are welcome.

Works on suno.com and all suno.com subdomains.

---

## Screenshot Descriptions (take these on suno.com)

1. **Main waveform view** - Show the extension with a song playing, waveform bars visible, time labels on each side. Caption: "Interactive waveform replaces the default Suno progress bar"

2. **Speed and loop controls** - Show the speed button (e.g. "1.5x") and loop button active (teal). Caption: "Playback speed control and loop toggle"

3. **Popup settings** - Show the extension popup with toggles. Caption: "Toggle features on and off from the popup"

4. **Loading state** - Show the skeleton shimmer animation while a song is decoding. Caption: "Animated loading while waveform decodes"

5. **Hover tooltip** - Show the hover tooltip on the waveform. Caption: "Hover to see exact timestamp"

## Screenshot Specs
- Size: 1280x800 or 640x400
- Format: PNG or JPEG
- Count: 1-5 required

## Promotional Tile (optional, recommended)
- Small: 440x280 PNG
- Should show the waveform UI with "Suno Waveform Seeker" text overlay
