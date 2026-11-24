# Native osu!mania 4K import

Source: `2299124 DECO_27 - Monitoring feat. Hatsune Miku.osz` in Downloads. Extracted source charts and `audio.mp3` remain outside Git in `C:/Users/pikac/Downloads/2299124-BeatSync`. The separate 2316808 osu!standard set is not used.

Original source counts (before tap-only filtering):

| Option | Version | Beatmap ID | Objects | Holds | Rating |
| --- | --- | ---: | ---: | ---: | ---: |
| Medium | anatha's going insane | 4953374 | 1,559 | 1,275 | 3.43★ |
| Hard (default) | Insane | 4917580 | 2,217 | 166 | 3.86★ |

Ratings are the supplied difficulty labels, not recalculated by BeatSync. Both sources declare `Mode: 3`, `CircleSize: 4`, set 2299124 and `AudioFilename: audio.mp3`. Audio decodes to 176.8 seconds, SHA-256 `7289bd87a77b90b099558f2da6009056b6ca101c262e54f8575bec2143086ec7`.

The importer rejects other modes/key counts. Lane is `min(3, floor(x*4/512))`; each head and hold tail timestamp is `4 + originalMilliseconds/1000`. The four seconds are preparation only: audio starts at source 0:00, and no quantization or musical offset is applied. Every generated object was compared independently against its original lane/head/tail. JSON provenance includes source hashes and IDs.

The current importer keeps every original head and removes only `endTime`, adapting hold starts into single taps. Playable outputs are **Medium 1,559 taps** and **Hard 2,217 taps**, with Hard preselected. Remaining tap lanes/timestamps are unchanged. Hold rendering/judgment remains supported by the engine and is tested with isolated fixtures, but neither selectable Monitoring chart contains holds. Production keeps Monitoring audio local because hosting permission has not been granted.

To reproduce after extracting the archive:

```powershell
node scripts/analyze-local-audio.mjs 'C:/Users/pikac/Downloads/2299124-BeatSync/audio.mp3' artifacts/osu-audio-analysis.json
node scripts/import-osu.mjs "C:/Users/pikac/Downloads/2299124-BeatSync/DECO27 - Monitoring feat. Hatsune Miku (Disguise) [anatha's going insane].osu" artifacts/osu-audio-analysis.json Medium
node scripts/import-osu.mjs 'C:/Users/pikac/Downloads/2299124-BeatSync/DECO27 - Monitoring feat. Hatsune Miku (Disguise) [Insane].osu' artifacts/osu-audio-analysis.json Hard
```

Browser tests use the actual matching local MP3, check source-clock synchronization near the beginning/middle/end, pause inside an active hold and await the real audio end and exactly one result. These checks do not measure physical speaker/input latency. No audio is uploaded or included in Git.
