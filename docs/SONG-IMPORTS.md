# Explicit local song imports

Imported from the four exact archive filenames in `scripts/song-imports.json`. Assignments are pinned to original beatmap IDs, not automatic difficulty/star thresholds. Requested star labels are retained exactly; published raw ratings and official set URLs are recorded as provenance. These requested labels correspond to the raw ratings truncated to two decimals.

| Song | Stars | Option | Original Version | Beatmap ID | Taps |
| --- | ---: | --- | --- | ---: | ---: |
| Yuusha (TV Size) | 1.49 | Easy | Easy | 4331793 | 353 |
| Yuusha (TV Size) | 3.12 | Med | Hard | 4331794 | 813 |
| Yuusha (TV Size) | 4.44 | Hard | CS' Fairy Tale | 4331792 | 1,192 |
| HIBANA | 1.28 | Easy | EZ | 1567254 | 656 |
| HIBANA | 1.94 | Med | NM | 1432276 | 1,011 |
| HIBANA | 3.13 | Hard | HD | 1578289 | 1,681 |
| HIBANA | 3.98 | Lunatic | MX | 1593446 | 2,290 |
| Mesmerizer | 2.00 | Med | Normal | 4603030 | 946 |
| Mesmerizer | 3.58 | Hard | Light Insane | 4672485 | 1,683 |
| Rabbit Hole | 4.00 | Hard | x0.9 | 4621071 | 2,210 |
| Rabbit Hole | 4.37 | Lunatic | x1.0 | 4508345 | 2,210 |

Exactly 11 charts; unmatched ratings: none. All selected files declare Mode 3 and CircleSize 4. Each original object contributes exactly one head tap. Tail fields are omitted; lanes, chords and original millisecond timestamps are preserved with the existing four-second preparation offset applied once.

Song Selection's Local song selector offers only the assigned difficulties. Monitoring keeps its separate Medium/Hard options and Hard default. Local song choices remember their selected difficulty during navigation. Results for these local songs remain local to the round.

Audio stays outside Git in `Downloads/BeatSync-imports/<setId>`. Select the matching AudioFilename shown on the card. Yuusha uses audio.ogg; Rabbit Hole Hard uses audio_0.9.mp3 and Lunatic uses audio.mp3. Other selections use their set's audio.mp3. File hashes prevent mixing recordings with the same filename from different archives. No audio was uploaded and no Firebase data or deployment was changed.

Reproduce from C:\WebPro with the exact .osz files in Downloads (uses existing Python standard library and installed Playwright/Chrome; no added dependencies):

```powershell
node scripts/import-song-sets.mjs 'C:/Users/pikac/Downloads'
node --test tests/import-song-sets.test.js
npm run build
```

The importer stages all 11 charts before writing outputs, validates source IDs/versions/counts and audio duration, and refuses to overwrite a different extracted source file. Tests independently read original HitObjects, compare every head/chord, verify audio hashes and exact assigned options, and check Rabbit Hole's separate timelines. Final result: 13 focused import tests passed; build passed. No gameplay/full-song/Firebase tests were run and nothing was deployed.

Official rating metadata: [Yuusha](https://osu.ppy.sh/beatmapsets/2070252), [HIBANA](https://osu.ppy.sh/beatmapsets/662688), [Mesmerizer](https://osu.ppy.sh/beatmapsets/2178387), [Rabbit Hole](https://osu.ppy.sh/beatmapsets/2141937).


## Completed six-song integration

The deployed Song Selection now shows separate selectable cards for Neon Pulse, Monitoring, Yuusha, HIBANA, Mesmerizer and Rabbit Hole. Selecting a card updates the title/artist/cover and local difficulty controls. The original 11 charts were reused byte-for-byte. Rabbit Hole still requires the matching audio file for each speed variant. All four new songs have create-only Firestore metadata documents; existing documents and user data were preserved. Only previously authorized audio is hosted.

Production build passed. The focused local integration check loaded all 11 chart/audio pairs and checked one tap per new song without full-song autoplay. A separate live selection check confirmed six cards, all assigned options and details. Read-back checks confirmed six catalog documents and exact hashes for all 11 deployed charts. Import checks and other previously passed suites were not rerun.

## Rabbit Hole active override (2026-11-24)

Rabbit Hole now exposes only **Hard (4.00★)**. It references the existing original x1.0 chart (BeatmapID 4508345) and normal-speed audio.mp3, duration 159 seconds. All 2,210 single taps, lanes and chords are unchanged. No chart was regenerated or rescaled. The legacy asset filename rabbit-hole-lunatic.json is retained for source/history compatibility; Lunatic is not an active option. The original 11-import table above documents archived source assignments; there are now 10 active imported options.

Use `C:/Users/pikac/Downloads/BeatSync-imports/2141937/audio.mp3`, not audio_0.9.mp3 and not Monitoring's audio. The active Hard label/rating is an explicit display override; original chart provenance is retained. Other songs are unchanged.
