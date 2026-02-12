/**
 * Suno Waveform Seeker – content script.
 *
 * DOM (as of Feb 2026):
 *   Bottom player bar (div.bg-background-secondary) has 3 sections:
 *     Left:   Song art + title
 *     Center: Transport controls (shuffle/prev/play/next/repeat) + seeker row
 *     Right:  Queue, like, share, volume
 *
 *   input[type="range"][aria-label="Playback progress"]
 *   Audio: <audio src="https://cdn1.suno.ai/{uuid}.m4a">
 *
 * Strategy:
 *   - Replace native seeker with waveform + inline transport buttons.
 *   - Hide native transport row; proxy prev/play/next via custom buttons.
 *   - Poll audio.currentTime for live progress.
 */

(function () {
  'use strict';

  var SunoWaveform = window.SunoWaveform;
  if (!SunoWaveform) return;

  // ─── SVG Icons (minimal, 16x16 viewBox) ──────────────────────

  var ICON_PREV = '<svg viewBox="0 0 16 16" fill="currentColor"><rect x="2" y="3" width="2" height="10" rx="0.5"/><polygon points="13,3 6,8 13,13"/></svg>';
  var ICON_PLAY = '<svg viewBox="0 0 16 16" fill="currentColor"><polygon points="4,2.5 13,8 4,13.5"/></svg>';
  var ICON_PAUSE = '<svg viewBox="0 0 16 16" fill="currentColor"><rect x="3" y="2.5" width="3.5" height="11" rx="1"/><rect x="9.5" y="2.5" width="3.5" height="11" rx="1"/></svg>';
  var ICON_NEXT = '<svg viewBox="0 0 16 16" fill="currentColor"><polygon points="3,3 10,8 3,13"/><rect x="12" y="3" width="2" height="10" rx="0.5"/></svg>';

  // ─── Selectors ─────────────────────────────────────────────────

  function findNativeRange() {
    return document.querySelector('input[type="range"][aria-label="Playback progress"]');
  }

  function findSeekerRow() {
    var range = findNativeRange();
    if (!range) return null;
    var el = range.parentElement;
    for (var depth = 0; depth < 6 && el; depth++) {
      var children = el.children;
      if (children.length >= 3) {
        var hasTime = false;
        var hasTrack = false;
        for (var i = 0; i < children.length; i++) {
          var txt = (children[i].textContent || '').trim();
          if (/^\d{1,2}:\d{2}$/.test(txt) || txt === '--:--') hasTime = true;
          if (children[i].contains(range)) hasTrack = true;
        }
        if (hasTime && hasTrack) return el;
      }
      el = el.parentElement;
    }
    el = range.parentElement;
    for (var j = 0; j < 2 && el; j++) el = el.parentElement;
    return el || range.parentElement;
  }

  /**
   * Find the native transport controls row (the flex row with shuffle/prev/play/next/repeat).
   * Strategy: find the smallest common ancestor of Prev and Next buttons.
   */
  function findTransportRow() {
    var prev = document.querySelector('button[aria-label="Playbar: Previous Song button"]');
    if (!prev) return null;
    var next = document.querySelector('button[aria-label="Playbar: Next Song button"]');
    if (!next) return null;
    // Walk up from prev to find smallest ancestor containing both buttons
    var el = prev.parentElement;
    for (var d = 0; d < 4 && el; d++) {
      if (el.contains(next)) return el;
      el = el.parentElement;
    }
    return prev.parentElement;
  }

  /** Bottom playbar container (div.bg-background-secondary containing the range). */
  function findPlaybarRoot() {
    var range = findNativeRange();
    if (!range) return null;
    var el = range;
    while (el && el !== document.body) {
      if (el.className && el.className.indexOf('bg-background-secondary') !== -1) return el;
      el = el.parentElement;
    }
    return null;
  }

  /** Find a native button by aria-label substring. Optional scope = only search inside that element (e.g. playbar). */
  function findNativeButton(labelPart, scope) {
    var selector = 'button[aria-label*="' + labelPart + '"]';
    return scope ? scope.querySelector(selector) : document.querySelector(selector);
  }

  function findPlayingAudio() {
    var audios = document.querySelectorAll('audio');
    var withSrc = null;
    for (var i = 0; i < audios.length; i++) {
      var a = audios[i];
      var src = a.currentSrc || a.src;
      if (!src || src.indexOf('sil-') !== -1) continue;
      if (!a.paused) return a;
      if (!withSrc) withSrc = a;
    }
    return withSrc;
  }

  // ─── State ─────────────────────────────────────────────────────

  var waveformApi = null;
  var waveformRoot = null;
  var hiddenRow = null;
  var hiddenTransport = null;
  var lastDecodedSrc = null;
  var pollRAF = null;
  var playPauseBtn = null;  // our custom play/pause button

  var cachedAudio = null;
  var cachedAudioSrc = null;
  var audioCheckCounter = 0;
  var AUDIO_CHECK_INTERVAL = 30;

  function getAudio() {
    audioCheckCounter++;
    if (audioCheckCounter >= AUDIO_CHECK_INTERVAL || !cachedAudio) {
      audioCheckCounter = 0;
      var a = findPlayingAudio();
      if (a) {
        var src = a.currentSrc || a.src;
        if (a !== cachedAudio || src !== cachedAudioSrc) {
          cachedAudio = a;
          cachedAudioSrc = src;
        }
      } else if (cachedAudio) {
        cachedAudio = null;
        cachedAudioSrc = null;
      }
    }
    if (cachedAudio && !document.body.contains(cachedAudio)) {
      cachedAudio = null;
      cachedAudioSrc = null;
    }
    return cachedAudio;
  }

  // ─── Transport proxy buttons ───────────────────────────────────

  /**
   * Create a proxy button that clicks a native Suno playbar button on activation.
   * Only looks for buttons inside the bottom playbar so we never trigger the wrong control (e.g. song page play).
   * nativeLabelParts: array of label substrings to try (first match wins).
   */
  function createProxyButton(className, svgHtml, ariaLabel, nativeLabelParts) {
    var parts = typeof nativeLabelParts === 'string' ? [nativeLabelParts] : nativeLabelParts;
    var btn = document.createElement('button');
    btn.setAttribute('class', className);
    btn.setAttribute('aria-label', ariaLabel);
    btn.setAttribute('type', 'button');
    btn.innerHTML = svgHtml;
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      var playbar = findPlaybarRoot();
      if (!playbar) return;
      for (var i = 0; i < parts.length; i++) {
        var native = findNativeButton(parts[i], playbar);
        if (native) {
          native.click();
          if (playPauseBtn && parts.some(function (p) { return p.indexOf('Pause') !== -1 || p.indexOf('Play') !== -1; })) {
            setTimeout(updatePlayPauseIcon, 80);
          }
          return;
        }
      }
    });
    return btn;
  }

  /** Update play/pause icon from the playbar's native button only (ignore song page buttons). */
  function updatePlayPauseIcon() {
    if (!playPauseBtn) return;
    var playbar = findPlaybarRoot();
    if (!playbar) return;
    var native = findNativeButton('Pause button', playbar) || findNativeButton('Play button', playbar);
    if (!native) return;
    var label = native.getAttribute('aria-label') || '';
    var isPaused = label.indexOf('Play button') !== -1;
    playPauseBtn.innerHTML = isPaused ? ICON_PLAY : ICON_PAUSE;
    playPauseBtn.setAttribute('aria-label', isPaused ? 'Play' : 'Pause');
  }

  // ─── Cleanup ───────────────────────────────────────────────────

  function cleanup() {
    if (pollRAF) { cancelAnimationFrame(pollRAF); pollRAF = null; }
    if (waveformApi) { waveformApi.destroy(); waveformApi = null; }
    if (hiddenRow) {
      hiddenRow.removeAttribute('data-suno-wf');
      hiddenRow.classList.remove('suno-wf-hidden');
      hiddenRow = null;
    }
    if (hiddenTransport) {
      hiddenTransport.classList.remove('suno-wf-hidden');
      hiddenTransport = null;
    }
    waveformRoot = null;
    lastDecodedSrc = null;
    cachedAudio = null;
    cachedAudioSrc = null;
    playPauseBtn = null;
  }

  // ─── Inject waveform + transport ───────────────────────────────

  function inject() {
    var seekerRow = findSeekerRow();
    if (!seekerRow || seekerRow.getAttribute('data-suno-wf') === 'done') return true;

    // Hide native seeker row
    seekerRow.setAttribute('data-suno-wf', 'done');
    seekerRow.classList.add('suno-wf-hidden');
    hiddenRow = seekerRow;

    // Hide native transport row
    var transportRow = findTransportRow();
    if (transportRow) {
      transportRow.classList.add('suno-wf-hidden');
      hiddenTransport = transportRow;
    }

    // Build our root: [prev] [play] [next] | [time] [waveform] [time] | [tooltip]
    var root = document.createElement('div');
    root.setAttribute('class', 'suno-wf-seeker-root');

    // Transport buttons
    var transportGroup = document.createElement('div');
    transportGroup.setAttribute('class', 'suno-wf-transport');

    var prevBtn = createProxyButton('suno-wf-btn suno-wf-btn-sm', ICON_PREV, 'Previous', 'Previous');
    playPauseBtn = createProxyButton('suno-wf-btn suno-wf-btn-play', ICON_PAUSE, 'Pause', ['Pause button', 'Play button']);
    var nextBtn = createProxyButton('suno-wf-btn suno-wf-btn-sm', ICON_NEXT, 'Next', 'Next');

    transportGroup.appendChild(prevBtn);
    transportGroup.appendChild(playPauseBtn);
    transportGroup.appendChild(nextBtn);

    root.appendChild(transportGroup);

    seekerRow.parentNode.insertBefore(root, seekerRow);
    waveformRoot = root;

    // Create waveform (appends time + canvas + time + tooltip into root)
    waveformApi = SunoWaveform.createWaveformSeeker(root);

    // Seek handler
    waveformApi.onSeek(function (ratio) {
      var audio = getAudio();
      if (audio && Number.isFinite(audio.duration) && audio.duration > 0) {
        audio.currentTime = ratio * audio.duration;
      }
      var range = findNativeRange();
      if (range) {
        var max = parseFloat(range.max) || 1;
        var nativeSetter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype, 'value'
        ).set;
        nativeSetter.call(range, String(ratio * max));
        range.dispatchEvent(new Event('input', { bubbles: true }));
        range.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });

    startPolling();
    return true;
  }

  // ─── Polling loop ──────────────────────────────────────────────

  function startPolling() {
    var playPauseCheckCounter = 0;

    function poll() {
      pollRAF = requestAnimationFrame(poll);
      if (!waveformApi) return;

      var audio = getAudio();
      if (audio && Number.isFinite(audio.duration) && audio.duration > 0) {
        var ratio = audio.currentTime / audio.duration;
        waveformApi.setProgress(ratio);
        waveformApi.setTimeLabels(audio.currentTime, audio.duration);
      } else {
        var range = findNativeRange();
        if (range) {
          var val = parseFloat(range.value) || 0;
          var max = parseFloat(range.max) || 1;
          var r = max > 0 ? val / max : 0;
          waveformApi.setProgress(r);
          waveformApi.setTimeLabels(val, max);
        }
      }

      // Decode waveform when audio src changes
      if (audio) {
        var src = audio.currentSrc || audio.src;
        if (src && src !== lastDecodedSrc) {
          lastDecodedSrc = src;
          waveformApi.setDecoding(true);
          SunoWaveform.fetchAndDecodeToBars(src).then(function (bars) {
            if (waveformApi) waveformApi.setBars(bars);
          });
        }
      }

      // Update play/pause icon periodically (~every 10 frames)
      playPauseCheckCounter++;
      if (playPauseCheckCounter >= 10) {
        playPauseCheckCounter = 0;
        updatePlayPauseIcon();
      }
    }
    pollRAF = requestAnimationFrame(poll);
  }

  // ─── Watch for player appearing / disappearing ─────────────────

  var observer = null;

  function watchDOM() {
    if (observer) return;
    observer = new MutationObserver(function () {
      if (waveformRoot && !document.body.contains(waveformRoot)) {
        cleanup();
      }
      if (!waveformRoot && findNativeRange()) {
        inject();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  // ─── Init ──────────────────────────────────────────────────────

  function init() {
    if (findNativeRange()) inject();
    watchDOM();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
