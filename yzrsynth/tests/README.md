# BEAT Phase 1 verification

Baseline: `main` at `5711edaae1b314f59221bcea67783452e4a1a215` (re-fetched before PR). Changes are limited to YZRsynth. Owner approval is required before merging.

## Before and after

The baseline puts one selected drum track's 16 steps below timbres, effects and the looper. At 375×667 each step measures 19.125×34 CSS px. Track tabs hide the other four tracks. Play, track selection and PENTA pads were exercised before the redesign; the baseline screenshot is captured from that exact commit.

The default BEAT view shows all five tracks, with manual 1–8 / 9–16 paging. At 375px the matrix cells measure 35.375×48px, separated by 4px gaps. This remains narrower than 44px: selecting a row and opening 拡大編集 provides the same eight bits in a 4×2 editor with large targets. Both editors share the existing 5×16 boolean arrays. Drum Undo retains 32 individual edits and never invokes looper Clear/Undo.

Red LEDs mean ON; an orange outline and the numbered header indicate playback independently. The position readout identifies the playing half even when it is not being edited. The edit page never follows playback. The common transport is labelled ドラム再生 / ドラム停止 and stays visible across BEAT and 演奏・設定. Precision editing has its own synchronized transport because a modal makes the background controls inert.

The performance view retains the five timbres, scale pads/keyboard, glide, arp, effects and original looper controls in a scrollable panel. Hiding held keys releases those voices; switching views preserves the sequencer timer, audio context and loop source. Short/landscape viewports scroll the editor while keeping the shared transport visible. `100dvh` and safe-area padding support changing available viewport space.

| Evidence | Link |
|---|---|
| Before, 375×667 | [Chromium](evidence/chromium-before-375.png) |
| BEAT, 375×667 | [Chromium](evidence/chromium-beat-375x667.png) |
| Precision, 375×667 | [Chromium](evidence/chromium-precision-375x667.png) |
| Performance, scrolled to keyboard | [Chromium](evidence/chromium-performance-375.png) |
| Other sizes | [Evidence directory](evidence/) |

## Results

PASS on Playwright Chromium 145.0.7632.6 and Linux WebKit 26.0. Both completed the entire interaction, geometry and PWA suite; see [Chromium results](evidence/chromium-results.json) and [WebKit results](evidence/webkit-results.json). WebKit required locally supplied GStreamer dependencies in this container; the audio signal checks passed, while host audio-device/D-Bus warnings mean no listening claim is made.

WebKit screenshots: [BEAT](evidence/webkit-beat-375x667.png), [precision](evidence/webkit-precision-375x667.png), [before](evidence/webkit-before-375.png).

## Automated checks

`beat.cjs` serves the frozen baseline and working tree on a local HTTP origin. No test hooks or dependencies are shipped in the app. Playwright 1.58.2 is a test-only dependency.

- Tap every one of the 80 matrix cells and assert that only the intended bit changes.
- Page selection, precision/normal synchronization, selected-track identity, close/scroll restoration.
- Bounded drum Undo, disabled empty history, no effect on a recorded loop buffer.
- Load an old-format hash with non-default settings; edit, verify exact compatible hash output, reload and compare data.
- Real sequencer playback, all five playhead cells, off-page position, editing during playback and stopping/resetting indicators.
- View switching preserves the timer/audio context/loop source; hiding held keyboard notes releases active voices.
- Access all timbres, both pad scales, free keyboard, arp selection, and pointer-drag effect/tempo knobs.
- Record live drum PCM, verify non-silent samples, overdub, and restore the prior buffer with the original looper Undo. Stopping drums leaves loop playback active.
- Assert byte-for-byte preservation of the core audio setup, drum synthesis/scheduler, effect mappings, looper recording, keyboard and hash code regions.
- No runtime JavaScript errors in the tested paths.
- Geometry/screenshots at 375×667, 390×844, 360×800, 375×500, 667×375 and 1280×900. Verify no horizontal overflow, visible transport, cell sizes, precision targets and keyboard height.
- Install the old service worker, update to `yapps-yzrsynth-v3-beat`, verify old app cache removal while unrelated cache survives. Make the origin unavailable, reload, edit and play drums offline.

Run from the repository root, with the baseline commit available:

```sh
npm install --prefix /tmp/yzr-tests playwright@1.58.2
/tmp/yzr-tests/node_modules/.bin/playwright install --with-deps chromium webkit
PLAYWRIGHT_MODULE=/tmp/yzr-tests/node_modules/playwright node yzrsynth/tests/beat.cjs
```

Optional `ENGINE=chromium` / `ENGINE=webkit`, `CHROMIUM_PATH` and `WEBKIT_PATH` select one engine or custom executables. Result JSON files include engine version, viewport geometry and completion status. Screenshots use 2× device scale; CSS viewport sizes are in filenames. The 1280×900 case checks desktop dimensions in the same touch-enabled context, not a separate desktop hardware test.

## Scope and remaining checks

Production changes: `index.html` (layout/UI bindings) and `sw.js` (cache version only). `manifest.json`, audio algorithms, scheduling interval/lookahead, recording/overdub method, hash schema and hosting paths are preserved. Removed the existing missing `../analytics.js` reference and consolidated overlapping navigation links into the app-list link. No external service or runtime library was added.

Actual iPhone SE3 Safari remains untested: perceived latency, sound quality, rapid/multi-finger accuracy, audio interruptions, VoiceOver gestures, thermal/background behavior, browser toolbar animation and installed-PWA safe areas/update lifecycle need Owner device testing. Desktop Linux WebKit is not iPhone Safari. A shortened viewport simulation does not verify Safari chrome behavior. PCM assertions establish signal presence, not listening quality or scheduling jitter.

Phase 2: global audio stop, broader KEYS/FX/LOOP redesign, clearer loop state across views, looper destructive-action UX and improved numeric tempo interaction. No pattern copy, drag painting or presets are included. The manifest retains `portrait-primary`; landscape browser layout is supported, but installed PWA orientation policy is unchanged. Existing hold-to-record behavior and overloaded looper UNDO/CLR are intentionally retained in this bounded phase.
