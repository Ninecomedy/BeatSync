# Local audio analysis

Recording is supplied by the user and is never included in Git, public assets, or network uploads.

- SHA-256: `b258de8839d30a298e7d7f230b3487e5f12bda3662832f9b3dfe7a850d1334d5`
- Decoded duration: 181.394285714 seconds.
- Excerpt: source seconds 18–54 (36 seconds); game lead-in: 2 seconds; total: 38 seconds.
- Chart: `public/beatmaps/monitoring-local.json`, 79 notes, fixed lane pattern D F J K variations.

## Original excerpt method (historical reference)

`scripts/analyze-local-audio.mjs <local MP3 path>` decodes the actual local recording in Chrome using OfflineAudioContext at 22050 Hz, averages channels, and computes positive log spectral flux using a 1024-sample Hann FFT and 220-sample hop (9.977 ms). Only numerical features and the file hash are written to ignored `artifacts/local-audio-analysis.json`.

A frequency/phase scan of spectral flux from seconds 15–55 across 90–200 BPM in 0.1 BPM steps found the strongest periodic component at 132.0 BPM (power 16857.20, phase 0.007797 seconds). This is an estimated beat grid, not publisher metadata.

`scripts/author-local-map.mjs` uses that grid, selects the strongest measured local onset peak within ±65 ms of each beat, excludes flux below 30, and assigns a fixed repeating lane pattern. Notes are timed to measured peak centers rather than quantized to a guessed tempo. The analysis resolution is approximately 10 ms; perceptual alignment and hardware audio latency may vary. No runtime randomization or runtime chart generation is used.

Game time for each note = 2 + source onset time − 18. AudioBufferSourceNode starts at game origin + 2, with source offset 18 and duration 36. Both rendering (circle center) and judgement use the same AudioContext clock. Pause suspends that clock; hit windows remain ±150 ms, Perfect ±60 ms. Short 10/30 ms edge fades avoid clicks.

The UI verifies the recording hash before enabling play, so differently trimmed or encoded versions cannot accidentally use this chart. The recording stays in memory until the page closes/reloads. Results are local to the completed round; existing Neon Pulse Firestore schema and rules are unchanged.

## Full-song charts and Settings (current)

The original 36-second demo is retained only as the immutable migration reference `monitoring-local.json`. The selectable charts are now `monitoring-normal.json` and `monitoring-hard.json`:

| Difficulty | Notes | Two-key chords | Playback      |
| ---------- | ----: | -------------: | ------------- |
| Normal     |   372 |              0 | 0:00–3:01.394 |
| Hard       |   713 |             45 | 0:00–3:01.394 |

Both have a four-second preparation period, then play every decoded sample through the actual source `ended` event, including the silent tail. The recording duration is 181.394285714 seconds; the complete round is about 185.394 seconds. Notes stop before the tail because no attacks were detected there.

The analyzer now processes all frames, not just the first 90 seconds. `scripts/author-full-charts.mjs` tracks the 132 BPM phase in eight-second sections, snaps beats/subdivisions to actual spectral-flux peaks, and gates density using local RMS energy. Hard uses alternating hands, measured sixteenth-onset bursts in strong passages, and cross-hand two-key chords on strong beat accents. Quiet sections reduce density. Same-lane repeats have at least 150 ms separation. Charts are generated offline and checked into Git; gameplay reads static JSON.

Normal imports all 79 existing notes without changing their lanes. The conversion is:

`fullGameTime = excerptGameTime - 2 + 18 + 4 = excerptGameTime + 20`.

The first subtraction removes the old lead-in, the second term restores the source offset, and the last term adds the new lead-in. This conversion happens only in the authoring script, never during playback. Source offset is zero for both full-song charts.

Settings use localStorage key `beatsync.settings.v1` on this browser/origin. Defaults: speed 1×, music 100%, SFX 50%, D F J K. Travel duration is `1.8 / speed` seconds, while score timing is unchanged. Music and synthesized hit feedback use independent GainNodes on the same AudioContext. Reset writes defaults immediately. Saving applies to the next game; settings are not stored in Firestore.

Figma frame 43:259 could not be retrieved because the Figma MCP Starter plan call limit blocked design and screenshot access; the web URL also failed. Settings uses existing BeatSync tokens and the already-downloaded b8500.png gear asset. Exact visual parity with that frame remains unverified.

## Native 4K default

The current default is now **osu! 4K (Tap Adaptation)** from native osu!mania set 2299124. It uses its own `audio.mp3` (176.8 seconds), not the MP3 analyzed above. Normal and Hard retain the existing charts and original recording. See [OSU-IMPORT.md](OSU-IMPORT.md) for verified mode/key count, provenance, exact audio path, and synchronization checks.
