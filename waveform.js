/**
 * Waveform seeker: decode audio, draw mirrored bars on canvas, handle seek.
 * Features: mirrored waveform, playhead line, hover tooltip, drag preview,
 *           RMS-smoothed bars, loading state, accent colors.
 * Uses background service worker to fetch cross-origin audio from Suno CDN.
 */

(function (global) {
  'use strict';

  // ─── Visual config ──────────────────────────────────────────────
  var COLOR_UNPLAYED    = 'rgba(255, 255, 255, 0.18)';
  var COLOR_PLAYED      = 'rgba(120, 220, 232, 0.9)';   // teal accent
  var COLOR_PLAYHEAD    = '#ffffff';
  var COLOR_HOVER_LINE  = 'rgba(255, 255, 255, 0.4)';
  var COLOR_DRAG_GHOST  = 'rgba(120, 220, 232, 0.45)';  // ghost playhead during drag
  var FALLBACK_BAR_H    = 2;
  var NUM_BARS          = 200;     // more bars for refined detail
  var BAR_GAP           = 1;      // tight gap between bars
  var MIN_BAR_H         = 1;      // minimum half-bar height
  var BAR_RADIUS        = 1;      // corner radius
  var PLAYHEAD_W        = 1.5;

  // ─── Shared AudioContext (avoids leak) ──────────────────────────
  var sharedAudioCtx = null;
  function getAudioCtx() {
    if (!sharedAudioCtx) {
      sharedAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    return sharedAudioCtx;
  }

  /** Format seconds as M:SS */
  function formatTime(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
    var m = Math.floor(seconds / 60);
    var s = Math.floor(seconds % 60);
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  // ─── Audio fetching ─────────────────────────────────────────────

  function fetchViaBackground(url) {
    return new Promise(function (resolve) {
      if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) {
        resolve(null);
        return;
      }
      try {
        chrome.runtime.sendMessage(
          { type: 'fetchAudioBuffer', url: url },
          function (response) {
            if (chrome.runtime.lastError || !response || !response.ok) {
              resolve(null);
              return;
            }
            var uint8 = new Uint8Array(response.data);
            resolve(uint8.buffer);
          }
        );
      } catch (e) {
        resolve(null);
      }
    }).then(function (buf) {
      if (buf) return buf;
      return fetch(url, { mode: 'cors' })
        .then(function (r) { return r.ok ? r.arrayBuffer() : null; })
        .catch(function () { return null; });
    });
  }

  function decodeBuffer(arrayBuffer) {
    if (!arrayBuffer) return Promise.resolve(null);
    try {
      var ctx = getAudioCtx();
      return new Promise(function (resolve) {
        ctx.decodeAudioData(
          arrayBuffer,
          function (decoded) {
            var channels = [];
            for (var i = 0; i < decoded.numberOfChannels; i++) {
              channels.push(decoded.getChannelData(i));
            }
            resolve(channels);
          },
          function () { resolve(null); }
        );
      });
    } catch (e) {
      return Promise.resolve(null);
    }
  }

  /**
   * Merge channels into bars using RMS (root-mean-square) for smoother look.
   */
  function mergeChannelsToBars(channels, numBars) {
    if (!channels || !channels.length) return null;
    var len = channels[0].length;
    var blockSize = len / numBars;
    var bars = [];
    for (var i = 0; i < numBars; i++) {
      var start = Math.floor(i * blockSize);
      var end = Math.min(Math.floor((i + 1) * blockSize), len);
      var sumSq = 0;
      var count = 0;
      for (var s = start; s < end; s++) {
        for (var c = 0; c < channels.length; c++) {
          var v = channels[c][s];
          sumSq += v * v;
          count++;
        }
      }
      // RMS value, then boost slightly for visual presence
      var rms = count > 0 ? Math.sqrt(sumSq / count) : 0;
      bars.push(Math.min(1, rms * 2.5));
    }
    return bars;
  }

  function fetchAndDecodeToBars(url) {
    if (!url) return Promise.resolve(null);
    return fetchViaBackground(url).then(function (buf) {
      if (!buf) return null;
      return decodeBuffer(buf);
    }).then(function (channels) {
      return mergeChannelsToBars(channels, NUM_BARS);
    });
  }

  // ─── Drawing helpers ────────────────────────────────────────────

  function drawRoundedRect(ctx, x, y, w, h, r) {
    if (w <= 0 || h <= 0) return;
    if (r > w / 2) r = w / 2;
    if (r > h / 2) r = h / 2;
    if (r < 0.5 || !ctx.roundRect) {
      ctx.rect(x, y, w, h);
      return;
    }
    ctx.roundRect(x, y, w, h, r);
  }

  // ─── Waveform Seeker Component ──────────────────────────────────

  function createWaveformSeeker(containerEl) {
    var bars = null;
    var targetBars = null;       // for animated transition
    var animatingBars = false;
    var progress = 0;
    var totalDuration = 0;
    var onSeekCb = null;
    var hoverRatio = -1;
    var dragRatio = -1;          // ghost playhead during drag
    var isDragging = false;
    var isDecoding = false;      // loading state
    var drawScheduled = false;

    // ─── DOM ──────────────────────────────────────────────────────
    var canvas = document.createElement('canvas');
    canvas.setAttribute('class', 'suno-wf-seeker-canvas');
    var ctx = canvas.getContext('2d');

    var currentTimeEl = document.createElement('span');
    currentTimeEl.setAttribute('class', 'suno-wf-seeker-time suno-wf-seeker-time-current');
    currentTimeEl.textContent = '0:00';

    var totalTimeEl = document.createElement('span');
    totalTimeEl.setAttribute('class', 'suno-wf-seeker-time suno-wf-seeker-time-total');
    totalTimeEl.textContent = '0:00';

    // Hover tooltip (lives in ROOT so it isn't clipped by container overflow)
    var hoverTooltip = document.createElement('div');
    hoverTooltip.setAttribute('class', 'suno-wf-hover-tooltip');
    hoverTooltip.textContent = '0:00';

    var containerDiv = document.createElement('div');
    containerDiv.setAttribute('class', 'suno-wf-seeker-container');
    containerDiv.setAttribute('tabindex', '0');
    containerDiv.setAttribute('role', 'slider');
    containerDiv.setAttribute('aria-label', 'Waveform seeker');
    containerDiv.setAttribute('aria-valuemin', '0');
    containerDiv.setAttribute('aria-valuemax', '100');
    containerDiv.setAttribute('aria-valuenow', '0');
    containerDiv.appendChild(canvas);

    containerEl.appendChild(currentTimeEl);
    containerEl.appendChild(containerDiv);
    containerEl.appendChild(totalTimeEl);
    containerEl.appendChild(hoverTooltip); // in root, not in containerDiv

    var wrapper = containerDiv;
    var resizeRAF = null;
    var logicalWidth = 0;
    var logicalHeight = 0;

    // ─── Batched drawing ──────────────────────────────────────────
    function scheduleDraw() {
      if (drawScheduled) return;
      drawScheduled = true;
      requestAnimationFrame(function () {
        drawScheduled = false;
        draw();
      });
    }

    // ─── Event helpers ────────────────────────────────────────────
    function getRatioFromEvent(e) {
      var rect = wrapper.getBoundingClientRect();
      var clientX = e.clientX != null ? e.clientX : (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
      var x = clientX - rect.left;
      var w = rect.width;
      if (w <= 0) return 0;
      var r = x / w;
      return r < 0 ? 0 : r > 1 ? 1 : r;
    }

    function handleSeek(ratio) {
      if (onSeekCb) onSeekCb(ratio);
    }

    // Pointer down starts drag — NO separate click handler (fixes double-seek)
    function onPointerDown(e) {
      e.preventDefault();
      e.stopPropagation();
      isDragging = true;
      var ratio = getRatioFromEvent(e);
      dragRatio = ratio;
      handleSeek(ratio);
      scheduleDraw();

      function onMove(ev) {
        ev.preventDefault();
        var r = getRatioFromEvent(ev);
        dragRatio = r;
        handleSeek(r);
        scheduleDraw();
      }
      function onUp() {
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

    containerDiv.addEventListener('keydown', function (e) {
      var step = 0.02;
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
    containerDiv.addEventListener('mousemove', function (e) {
      var rect = wrapper.getBoundingClientRect();
      var x = e.clientX - rect.left;
      var w = rect.width;
      if (w <= 0) { hoverRatio = -1; return; }
      hoverRatio = Math.max(0, Math.min(1, x / w));

      // Position tooltip (in root coords, above containerDiv)
      var rootRect = containerEl.getBoundingClientRect();
      var containerRect = rect;
      hoverTooltip.textContent = formatTime(hoverRatio * totalDuration);
      hoverTooltip.classList.add('suno-wf-hover-tooltip--visible');

      var tooltipW = hoverTooltip.offsetWidth || 36;
      var absX = containerRect.left - rootRect.left + x;
      var leftPx = absX - tooltipW / 2;
      if (leftPx < 0) leftPx = 0;
      var maxLeft = rootRect.width - tooltipW;
      if (leftPx > maxLeft) leftPx = maxLeft;
      hoverTooltip.style.left = leftPx + 'px';

      scheduleDraw();
    });

    containerDiv.addEventListener('mouseleave', function () {
      hoverRatio = -1;
      hoverTooltip.classList.remove('suno-wf-hover-tooltip--visible');
      scheduleDraw();
    });

    // ─── Drawing ──────────────────────────────────────────────────
    function draw() {
      var w = logicalWidth;
      var h = logicalHeight;
      if (!w || !h) return;
      ctx.clearRect(0, 0, w, h);

      var centerY = h / 2;
      var progressX = progress * w;

      if (bars && bars.length > 0) {
        var barSlotW = w / bars.length;
        var barW = Math.max(1, barSlotW - BAR_GAP);

        for (var i = 0; i < bars.length; i++) {
          var x = i * barSlotW + BAR_GAP / 2;
          var amp = bars[i];
          var halfBarH = Math.max(MIN_BAR_H, amp * (centerY - 2));
          var barMidX = x + barW / 2;
          ctx.fillStyle = (barMidX <= progressX) ? COLOR_PLAYED : COLOR_UNPLAYED;

          // Upper half
          ctx.beginPath();
          drawRoundedRect(ctx, x, centerY - halfBarH, barW, halfBarH, BAR_RADIUS);
          ctx.fill();

          // Lower half
          ctx.beginPath();
          drawRoundedRect(ctx, x, centerY, barW, halfBarH, BAR_RADIUS);
          ctx.fill();
        }
      } else if (isDecoding) {
        // Loading state: pulsing dots
        var dotCount = 5;
        var dotR = 3;
        var dotGap = 14;
        var startX = (w - (dotCount - 1) * dotGap) / 2;
        var time = Date.now() / 400;
        for (var d = 0; d < dotCount; d++) {
          var alpha = 0.25 + 0.35 * Math.sin(time + d * 0.8);
          ctx.fillStyle = 'rgba(120, 220, 232, ' + alpha.toFixed(2) + ')';
          ctx.beginPath();
          ctx.arc(startX + d * dotGap, centerY, dotR, 0, Math.PI * 2);
          ctx.fill();
        }
        // Keep animating
        scheduleDraw();
      } else {
        // Fallback: thin bar
        ctx.fillStyle = COLOR_UNPLAYED;
        ctx.fillRect(0, centerY - FALLBACK_BAR_H / 2, w, FALLBACK_BAR_H);
        ctx.fillStyle = COLOR_PLAYED;
        ctx.fillRect(0, centerY - FALLBACK_BAR_H / 2, progressX, FALLBACK_BAR_H);
      }

      // ── Playhead line ──────────────────────────────────────────
      if (progress > 0 && progress < 1) {
        ctx.fillStyle = COLOR_PLAYHEAD;
        var phX = Math.round(progressX) - PLAYHEAD_W / 2;
        ctx.fillRect(phX, 0, PLAYHEAD_W, h);
      }

      // ── Drag ghost playhead ────────────────────────────────────
      if (isDragging && dragRatio >= 0 && dragRatio <= 1) {
        var gx = Math.round(dragRatio * w);
        ctx.fillStyle = COLOR_DRAG_GHOST;
        ctx.fillRect(gx - 1, 0, 2, h);
      }

      // ── Hover cursor line ──────────────────────────────────────
      if (!isDragging && hoverRatio >= 0 && hoverRatio <= 1) {
        var hx = Math.round(hoverRatio * w);
        ctx.fillStyle = COLOR_HOVER_LINE;
        ctx.fillRect(hx - 0.5, 0, 1, h);
      }
    }

    // ─── Bar transition animation ─────────────────────────────────
    function animateBarsIn(newBars) {
      if (!bars || bars.length !== newBars.length) {
        bars = newBars;
        scheduleDraw();
        return;
      }
      targetBars = newBars;
      animatingBars = true;
      var startBars = bars.slice();
      var startTime = performance.now();
      var duration = 400; // ms

      function step(now) {
        var t = Math.min(1, (now - startTime) / duration);
        // Ease out
        var ease = 1 - (1 - t) * (1 - t);
        var current = [];
        for (var i = 0; i < newBars.length; i++) {
          var from = i < startBars.length ? startBars[i] : 0;
          current.push(from + (newBars[i] - from) * ease);
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
      requestAnimationFrame(step);
    }

    // ─── Resize handling ──────────────────────────────────────────
    function resize() {
      var dpr = window.devicePixelRatio || 1;
      var rect = wrapper.getBoundingClientRect();
      var w = rect.width;
      var h = rect.height;
      if (w <= 0 || h <= 0) return;
      logicalWidth = w;
      logicalHeight = h;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
      draw();
    }

    var resizeObserver = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(function () {
        if (resizeRAF) cancelAnimationFrame(resizeRAF);
        resizeRAF = requestAnimationFrame(function () {
          resizeRAF = null;
          resize();
        });
      });
      resizeObserver.observe(wrapper);
    }

    function onWindowResize() {
      if (resizeRAF) cancelAnimationFrame(resizeRAF);
      resizeRAF = requestAnimationFrame(function () {
        resizeRAF = null;
        resize();
      });
    }
    window.addEventListener('resize', onWindowResize);
    resize();

    // ─── Public API ───────────────────────────────────────────────
    return {
      setProgress: function (ratio) {
        var clamped = ratio < 0 ? 0 : ratio > 1 ? 1 : ratio;
        if (clamped === progress) return; // skip redundant draws
        progress = clamped;
        containerDiv.setAttribute('aria-valuenow', String(Math.round(progress * 100)));
        scheduleDraw();
      },
      setBars: function (newBars) {
        isDecoding = false;
        if (newBars) {
          animateBarsIn(newBars);
        } else {
          bars = null;
          scheduleDraw();
        }
      },
      setDecoding: function (val) {
        isDecoding = !!val;
        scheduleDraw();
      },
      onSeek: function (cb) {
        onSeekCb = cb;
      },
      setTimeLabels: function (currentSeconds, totalSeconds) {
        var ct = formatTime(currentSeconds);
        var tt = formatTime(totalSeconds);
        if (currentTimeEl.textContent !== ct) currentTimeEl.textContent = ct;
        if (totalTimeEl.textContent !== tt) totalTimeEl.textContent = tt;
        totalDuration = totalSeconds || 0;
      },
      destroy: function () {
        if (resizeObserver && wrapper) resizeObserver.unobserve(wrapper);
        window.removeEventListener('resize', onWindowResize);
        if (resizeRAF) cancelAnimationFrame(resizeRAF);
        containerDiv.removeEventListener('mousedown', onPointerDown);
        containerDiv.removeEventListener('touchstart', onPointerDown);
        if (containerEl && containerEl.parentNode) {
          containerEl.parentNode.removeChild(containerEl);
        }
      }
    };
  }

  global.SunoWaveform = {
    createWaveformSeeker: createWaveformSeeker,
    fetchAndDecodeToBars: fetchAndDecodeToBars,
    formatTime: formatTime
  };
})(typeof window !== 'undefined' ? window : this);
