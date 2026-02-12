# Privacy Policy — Suno Waveform Seeker

**Last updated:** February 2026

## Summary

Suno Waveform Seeker does not collect, store, transmit, or share any user data.

## Data Collection

This extension collects **no data whatsoever**. Specifically:

- No personally identifiable information
- No browsing history or web activity
- No analytics, telemetry, or usage tracking
- No cookies (beyond what suno.com itself sets)
- No communication with external servers

## Local Storage

The extension uses `chrome.storage.sync` solely to save your preferences (e.g., playback speed, loop toggle, which controls are enabled). These settings are stored locally in your browser's Chrome sync storage and are never transmitted to any third party.

## Network Requests

The only network requests made by this extension are to Suno's own audio CDN (`cdn1.suno.ai`, `cdn2.suno.ai`) to fetch audio data for waveform generation. This is the same audio your browser already loads when you play a song on suno.com. No data is sent to any other server.

## Permissions

- **Storage**: Used to save your UI preferences locally
- **Host permissions** (`cdn1.suno.ai`, `cdn2.suno.ai`): Required to fetch audio data for waveform decoding
- **Content script** (`suno.com`): Required to inject the waveform visualizer into the page

## Third Parties

This extension does not use any third-party services, analytics tools, or tracking libraries.

## Changes

If this privacy policy changes, the update will be posted here with a revised date.

## Contact

For questions about this privacy policy, open an issue on the [GitHub repository](https://github.com/IDAPIXL/suno-waveform-seeker).
