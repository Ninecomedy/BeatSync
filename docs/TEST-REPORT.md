# BeatSync — รายงานทดสอบรอบแรก

วันที่: 19 พฤศจิกายน 2026 (Asia/Bangkok)

## สภาพแวดล้อม

- Windows, Node.js 24.21.0, Java 21.0.8
- Google Chrome headless ผ่าน Playwright; desktop 1100×720 และ mobile viewport 390×844
- Firebase Auth Emulator `127.0.0.1:9099`, Firestore Emulator `127.0.0.1:8080`
- รอบรวมสุดท้ายใช้ Firebase CLI 15.37.0, Firestore Emulator 1.22.0 (Standard edition)
- หน้าเว็บใช้ `demo-beatsync`; Rules tests ใช้ `demo-beatsync-rules` แยกกัน
- ไม่มีการเขียนข้อมูลหรือ deploy ไป Firebase production / test cloud project

## ผลทดสอบ

คำสั่งรวม `npm run test:all` **ผ่าน exit code 0**: เริ่ม Emulator → unit/Rules 9/9 → Chrome 2/2 (36.7 วินาที) → production build → ปิด Emulator อัตโนมัติ

| ชุดทดสอบ                   | ผลที่ตรวจ                                                                                                                 |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Engine: 4 tests           | ผ่าน: beatmap 48 โน้ตเรียงเวลา, hit window, Perfect/Good, duplicate/wrong-lane/early input, miss และ combo reset           |
| Firestore Rules: 5 groups | ผ่าน: owner/schema/field bounds, app queries, immutable scores, reactions แยก UID, chat identity, deny guest และ Comment |
| Chrome E2E: 2 tests       | ผ่าน: สมัคร → Login → เล่นครบ 27 วินาที → save → Leaderboard → Profile; สองบัญชี; mobile validation; pause/resume/quit         |
| Production build          | ผ่าน `npm run build`                                                                                                     |
| Formatting                | ผ่าน `npm run format:check`                                                                                              |
| Production dependencies   | `npm audit --omit=dev`: 0 vulnerabilities                                                                               |

เส้นทางหลักใน Chrome ได้คะแนน 48,000 จากการเล่นตาม audio clock; ตรวจตัวเลขเดียวกันบนผลจบเพลง, Leaderboard และ Profile จริง ไม่ได้ mock Firestore หรือ inject คะแนนลง database จาก test fixture ของ UI

## การทดสอบสองบัญชี

เปิด Chrome contexts สองชุดแยก session และสมัคร Email/Password สองบัญชีจริงบน Auth Emulator:

1. A เล่นจนจบ; B ที่เปิด Leaderboard อยู่เห็นคะแนนใหม่โดยไม่ reload
2. B Like → A เห็น 1; B Love → A เห็น 1; B ปิด Like → A เห็น 0
3. A Love รอบของตัวเอง → B เห็นรวม 2 และสถานะปุ่มของแต่ละบัญชีแยกกัน
4. B ส่งข้อความภาษาไทยพร้อมข้อความ `<img ... onerror=...>` → A เห็นเป็นข้อความธรรมดา ไม่เกิด image element
5. A ตอบกลับ → B เห็นทันที
6. A เปิด Profile → ชื่อและ best score ตรง; reload แล้วยัง login และเห็นคะแนน; logout แล้วกลับหน้า Login

## สิทธิ์และการโจมตีที่ทดสอบ

- ไม่ login: list profiles/scores/messages และสร้าง score ถูกปฏิเสธ
- เขียน profile ของคนอื่น, เพิ่ม `admin`/`email`, ชื่อยาวเกิน, omit required fields ถูกปฏิเสธ
- ปลอม UID หรือ playerName, คะแนนติดลบ/เกิน/ไม่ตรง hit counts, field ผิดชนิด, combo เกิน, songId อื่น, timestamp ย้อนหลัง และ extra fields ถูกปฏิเสธ
- เจ้าของและคนอื่นแก้ไข score หรือเปลี่ยน owner หลังสร้างไม่ได้; ลบ score ไม่ได้
- เขียน Reaction เป็น UID ของคนอื่น, ลบ required field, เปลี่ยน bool เป็น number, parent score ไม่มี และเพิ่ม counter ลง score ถูกปฏิเสธ
- Chat ปลอมผู้เขียน, text ว่าง/ช่องว่าง/เกิน 280/ผิดชนิด, timestamp client และแก้ข้อความเดิม ถูกปฏิเสธ
- Comment ถูกปฏิเสธตาม scope รอบแรก
- Profile ไม่มี PII ตั้งแต่ schema; อีเมลเก็บเฉพาะ Firebase Auth

## ภาพและการตรวจ UI

ตรวจภาพ Login, Start, Game, Leaderboard + Chat, Profile และ Register mobile เทียบกับ frames ของ Figma ใช้โลโก้/พื้นหลัง/ไอคอนของทีมเป็นไฟล์ local ตรวจไฟล์มีขนาดมากกว่า 0 และภาพแสดงในตำแหน่งจริง

ภาพจากการรันทดสอบอยู่ `artifacts/login.png`, `start.png`, `game.png`, `leaderboard.png`, `profile.png`, `register-mobile.png` รายงาน browser อยู่ `playwright-report/index.html` ทั้งสองโฟลเดอร์ไม่เข้า Git

ปรับตาม scope: Email login แทน Google; demo cover/เสียงต้นฉบับแทนเพลงศิลปิน; avatar จากชื่อบัญชี; best score แทน XP/About Me; เพิ่ม navigation และ responsive layout จึงไม่ได้อ้างว่าเป็น pixel-perfect ทุก breakpoint

## ข้อจำกัดและสิ่งที่ทีมต้องทำ

- **Comment ยังไม่ทำในรอบนี้** ต้องรับแบบ UI แล้วทำตาม `COMMENTS-NEXT.md` และผ่าน tests ก่อนส่งอาจารย์
- ยังไม่ได้ตั้งหรือ deploy Firebase cloud project จริง ทีมต้องเปิด Email/Password, สร้าง Standard Firestore, ใส่ Web config และ deploy Rules/indexes ตาม README
- Emulator ไม่พิสูจน์ว่า composite index บน cloud สร้างเสร็จ ต้องตรวจ index readiness บน test project
- ทดสอบ timing/input ด้วย automated browser จริงแต่ยังไม่ได้วัดความหน่วงเสียงจากลำโพง/Bluetooth หรือความรู้สึกเล่นด้วยคน ต้องลองด้วยหูฟังก่อนส่ง
- ยังไม่ได้ตรวจ Safari/Firefox หรือ touch hardware จริง; mobile ตรวจด้วย viewport และไม่มี overflow
- คะแนนคำนวณฝั่ง client: Rules ป้องกันการเขียนแทนคนอื่นและข้อมูลผิด schema แต่ไม่ใช่ระบบ anti-cheat ที่พิสูจน์การเล่นจริง
- Leaderboard จำกัด 20 รอบ; แชต 50 ข้อความล่าสุด; reaction listeners ต่อแถว เหมาะกับ demo แต่ยังไม่ได้ load test/เพิ่ม moderation/rate limiting
- `npm audit` ทั้ง dev tree ยังพบ 14 moderate advisories ใน dependencies ของ tooling ไม่มี high/critical; production tree 0 ไม่ใช้ force downgrade Firebase
- Build เตือน Firebase bundle ใหญ่กว่า 500 kB เป็นคำเตือนด้านขนาด ไม่ใช่ build failure

## บันทึกการแก้ปัญหาระหว่างตรวจ

ครั้งแรก sandbox ปิด localhost ทำให้ integration tests เชื่อมไม่ได้ จึงรันด้วยสิทธิ์เข้าถึง local Emulator แล้วผ่าน มีครั้งหนึ่ง browser reports ชนกันเพราะรัน test สอง process ซ้อนกัน (ขั้นตอนฟีเจอร์ผ่าน แต่ trace teardown ล้มเหลว) แก้ด้วยการรันครั้งละชุด จากนั้น Chrome ผ่าน 2/2 ใน 34.5 วินาที

อัปเดต Firebase CLI และ override gRPC เป็นรุ่นที่แก้ high/critical advisories แล้ว กำหนด namespace Rules tests แยกเพื่อรันซ้ำโดยไม่ล้างข้อมูลในหน้าเว็บ

พบว่า Windows ใช้ environment key `Path` แต่ object ที่ส่ง child process เพิ่ม `PATH` แยก ทำให้คำสั่งย่อยหา Node ไม่เจอ แก้ launcher ให้รวมเป็น key เดียวและเติม directory ของ `process.execPath` จากนั้นทดสอบรวมผ่านตั้งแต่เริ่มจนปิด Emulator

## Update — 20 พฤศจิกายน 2026: Song Selection และโน้ตวงกลม

- Start Game จากหน้า Start และ Profile เปิด Song Selection (Figma 29:84) มี Neon Pulse หนึ่งเพลง พร้อมปุ่มถ้วยไป Leaderboard และปุ่มเล่นเข้าเกมเดิม
- ลบบรรทัดข้อมูลเพลง/คำแนะนำ D F J K บนหน้า Start และ footer LOCAL EMULATOR · Web Programming จากทุกหน้า โดยคงปุ่ม D F J K ในเกม
- ใช้ canvas arc วาดวงกลมเรืองแสง กึ่งกลาง x ตรงกลาง lane รวมระยะ gap; กึ่งกลาง y ใช้สูตรเวลาเดิมและถึงเส้นตัดสินเมื่อ note.time ตรง audio clock
- ไม่เปลี่ยน audio.js, engine.js, Beatmap, hit window หรือ Firestore Rules
- npm run test:all ผ่าน 11/11 (engine 4, Rules 5, Chrome 2) และ production build ผ่าน
- Browser tests ปรับทั้ง desktop และ mobile ให้ผ่าน Song Selection; ตรวจว่ามีหนึ่งเพลง ยังไม่เข้าเกมก่อนกด ▶ ไม่มีข้อความที่ลบ และไม่มี horizontal overflow
- ตรวจ canvas draw จริงว่ามีวงกลมเต็ม 2π, รัศมีมากกว่า 0, กึ่งกลางตรง lane และตำแหน่งตามเวลาเพลง พร้อมเล่นครบ 27 วินาทีจนคะแนนขึ้น Leaderboard/Profile
- ทดสอบ Like/Love และ Chat สองบัญชีต่อจากเส้นทางใหม่ผ่านเหมือนเดิม
- ภาพตรวจ: artifacts/song-selection.png, artifacts/song-selection-mobile.png และ artifacts/game.png
- แก้ record artwork ล้น desktop ที่เทสต์พบ และจัดปกให้ตรงช่อง artwork; ไม่พบการเปลี่ยนเกณฑ์คะแนน

ตรวจซ้ำหลังจัดภาพพบพื้นที่โปร่งใสของ record image ขวาง pointer ของปุ่ม ▶ บน desktop จึงกำหนด pointer-events: none เฉพาะ artwork ตกแต่ง และทดสอบด้วย click ปกติ (ไม่มี force click) อีกครั้ง

## Local MP3 demo — 2026-11-20

- `npm run test:all` with VITE_USE_EMULATORS=true and BEATSYNC_LOCAL_AUDIO pointing to the supplied original MP3: **12 passed** (9 game/rules + 3 Chrome browser), 0 skipped, 0 failed.
- Actual 36-second recording excerpt played to completion on localhost. Browser test pressed DFJK against the real AudioContext clock, asserted Miss 0 and positive score, checked the scheduled source offset/duration, circular rendering, Pause/Resume, replay, file rejection, and reselect after refresh.
- Existing Neon Pulse two-account leaderboard/profile/reactions/live-chat regression passed.
- Production build passed. Existing >500 kB Firebase bundle size warning remains.
- `npm run format:check` and `git diff --check` passed.
- Screenshots in ignored artifacts/: local-selection.png, local-game.png, local-result.png.
- Test-owned emulator and Vite processes shut down at completion; see README to start locally.

## Full song + Settings — 2026-11-21

Verified locally against the original MP3 and Firebase Auth/Firestore Emulators.

- Track: 181.394285714 seconds (3:01.394); four-second preparation, then source offset 0 through the actual audio end, including its silent tail.
- Normal: 372 notes. Real-time Chrome run: 372,000, Perfect 372, Miss 0, exactly one result screen.
- Hard: 713 notes, including 45 two-key chords. Real-time Chrome run: 713,000, Perfect 713, Miss 0, exactly one result screen.
- Both source end events observed at approximately 181.4013 seconds of playback (audio render-quantum granularity); playback rate was not changed and no sections were skipped.
- Source-clock checks: Normal at 5.73025 / 90.41778 / 168.15111 seconds; Hard at 5.73025 / 90.19828 / 168.15111 seconds. Dispatch error was 1.75–10.23 ms. These chart timestamps also match peaks measured from the original recording. This verifies software synchronization; physical output-device latency was not measured.
- Existing Neon Pulse two-account score-save, Leaderboard, Profile, Like/Love and real-time chat passed. Mobile/pause/quit regression passed.
- Settings passed: gear navigation from Start and Song Selection; duplicate rejection; A S K L remap; 1.6× speed preserving hit timing; independent 25% music / 70% SFX gain paths and actual hit oscillator; persistence across refresh; lane labels; reset persistence; desktop/mobile layout without horizontal overflow.
- Final verification totals across runs: **17 passing tests** = 7 game/settings/chart unit tests + 5 Firestore Rules tests + 5 browser tests. Both full-song browser tests ran with the original MP3 (not skipped).
- Initial all-suite run passed the full-song and existing browser tests but timed out on an outdated exact slider selector in the Settings test. Corrected the test's range interaction and added explicit accessible names; focused Settings rerun passed in 6.7 seconds. Final `npm test`, `npm run build`, `npm run format:check`, and `git diff --check` passed. No need to repeat the unchanged six-minute full-song runs for label-only changes.
- Build retains the existing >500 kB Firebase bundle advisory; no build errors.
- Screenshots: artifacts/settings.png, settings-mobile.png, full-Normal-selection.png, full-Normal-game.png, full-Normal-result.png, and corresponding Hard files (ignored by Git).
- The original MP3 remains in Downloads, is not tracked, and is read via the browser File API without upload. Experimental scores remain local to a round.
- Figma Settings frame 43:259 remains visually unverified: MCP design/screenshot access hit its Starter plan limit and the public web fallback did not load. Existing project tokens and gear asset were reused.

## Native osu!mania 4K default — 2026-11-21

- Archive 2299124 verified locally: all three `.osu` entries declare Mode 3 and CircleSize 4. Selected Disguise / Insane, BeatmapID 4917580. Archive 2316808 was not imported.
- Default label: osu! 4K (Tap Adaptation). All 2,217 lane/start-time pairs match the extracted chart exactly. Its 166 holds become start taps; no release notes are synthesized.
- Matching AudioFilename audio.mp3 extracted outside Git to Downloads/2299124-BeatSync. Duration 176.800 seconds. Normal/Hard keep their different original MP3 and remain selectable. Fingerprints gate both Play and direct game navigation.
- Audio onset sanity checks: chart 4.008 s → nearest measured flux peak 4.01415 s (+6.15 ms); chart 175.144 s → 175.13524 s (−8.76 ms). No offset or retiming was applied. See artifacts/osu-sync-onsets.json and docs/OSU-IMPORT.md for method and limitations.
- Final verification: **20 passed, 0 failed, 0 skipped** = 9 game/import/settings unit tests + 5 Firebase Rules tests + 6 Chrome browser tests. Full-song tests used real audio, unchanged playback rate, separate contexts and three workers.
- Native result: 2,217,000, Perfect 2217, Good 0, Miss 0, one result screen. Actual audio end observed at 176.80086 seconds. Playback-clock checkpoint errors: 6.25 ms near 5.144 s, 0.79 ms near 90.030 s, 3.09 ms near 168.099 s.
- Normal: 372,000 / Miss 0. Hard: 713,000 / Miss 0. Both reached their actual audio end with one result. Neon Pulse saving, Leaderboard/Profile, Like/Love, live chat, mobile/pause and saved Settings tests passed.
- Wrong-file rejection, default native selection, incompatible audio when switching difficulty, matching-buffer reuse, replay and refresh/reselection were checked.
- Production build passed; existing Firebase bundle-size advisory remains. Formatting and diff checks passed. No MP3, OSZ or original OSU file is tracked in Git.
- The first verification was interrupted with the tool session; a retry discovered its servers were also stopped. Final verification launched fresh Auth/Firestore Emulators and completed with exit code 0. Durable log: artifacts/osu-verification.log; exit marker: artifacts/osu-verification-exit.txt; Playwright .last-run.json reports passed.
- Screenshots: artifacts/full-osu-selection.png, full-osu-game.png, full-osu-result.png (ignored artifacts).

## Gameplay countdown and button targets — 2026-11-21

- Resume now keeps the existing audio source suspended through 3 → 2 → 1, one second each. A cancellation token invalidates old countdowns; Cancel resume, hidden-tab pause and Quit clean up pending timers. Inputs and engine advancement are blocked while paused/counting down.
- Centered PAUSED/countdown/hit feedback has priority over the enlarged combo. The combo is directly below the judgment and hidden during pause/countdown.
- The full-height transparent canvas uses each button's live DOM center as its hit target. Circles have diameter 70% of the corresponding button; buttons are raised to 32 px from the bottom. Removed the old horizontal judgment stroke. Existing ±60 ms Perfect / ±150 ms Good bounds are unchanged.
- **24 passing tests, no failures or skips**: 9 game/chart/settings unit tests + 5 Firebase Rules tests + 10 Chrome browser tests. Final production build passed. Existing Firebase bundle-size advisory remains.
- New browser tests pause near the first note, measure 3/2/1 intervals, compare frozen audio and note coordinates throughout, send keyboard and pointer presses without changing score, repeat pause/resume cycles, and compare every resume invocation with the exact suspended timestamp. The source starts only once. A subsequent beat is judged PERFECT. Cancel and Quit do not permit an old timer to restart audio.
- Alignment and 70% diameter verified at 0.5×, 1× and 2×, including a 390×844 mobile viewport. Canvas samples are compared against rendered frame time and live button geometry. Judgment center and the larger combo's placement below it are asserted.
- Full recordings run at normal rate with the new resume countdown: Normal 372,000; Hard 713,000; osu! 4K 2,217,000. All have Miss 0, actual audio-end confirmation and one result screen. Neon Pulse score saving, Profile, reactions, chat and settings persistence also passed.
- `npm run format:check` and `git diff --check` passed. Durable full-run output: artifacts/gameplay-verification.log, exit marker 0. Screenshots: artifacts/game-paused.png, game-countdown.png, game-perfect.png and game-target-{0.5,1,2}.png.
- No screenshot attachment was available in the request; implementation followed the written layout requirements and was visually reviewed in desktop/mobile browser captures.

## Exit Song → Song Selection — 2026-11-21

- Renamed Quit run to Exit Song and changed its destination to Song Selection. Calls existing cleanup immediately before navigation, stopping audio, canceling any resume countdown and removing game listeners without invoking finish/save.
- Retains local decoded audio and difficulty. The selected card and preview now reflect the song just played; native osu and non-default Hard both retain their selection. Neon Pulse remains selectable directly.
- Browser checks passed for Play → Pause → Exit Song, replay without selecting the file again, exit during an active countdown followed by a 3.2-second wait (audio remains closed, no result), starting Neon Pulse directly, returning with Neon selected, and Profile score staying zero for abandoned runs.
- Build passed; 9 unit tests and 9 relevant browser cases passed across focused runs (2 Exit Song cases plus 7 existing flow/gameplay/settings cases). The unchanged full-track runs and Rules suite were not repeated for this navigation-only change. Existing full-track test exit selectors/navigation assertions were updated.

## 2026-11-21 — Original Medium/Hard charts and long holds

- Verified directly against archive 2299124: both sources are Mode 3 / CircleSize 4. Every JSON object matches the original lane, head and hold tail exactly (only the common four-second preparation offset). Matching AudioFilename/audio SHA-256 confirmed against the archive.
- Medium: anatha's going insane, ID 4953374, 1,559 objects / 1,275 holds. Hard (default): Insane, ID 4917580, 2,217 objects / 166 holds. These are the only selectable Monitoring options. Both use local audio.mp3, duration 176.800 seconds; audio remains outside Git and is never uploaded.
- Final `node --test tests/game.test.js tests/firebase.test.js` against the existing Auth/Firestore emulators: **17 passed** (12 game/settings/import tests + 5 rule tests), 0 failures/skips.
- Final `npm run build`: **passed**. Existing Vite chunk-size advisory remains; no build errors.
- Final `npx playwright test --workers=2 --fully-parallel`, with BEATSYNC_OSU_AUDIO set to the matching local file: **13 passed**, 0 failures/skips. Total: **30 passing tests**.
- Real Chrome full-length playback: Medium **1,559,000**, Hard **2,217,000**, all objects Perfect, **Miss 0**, actual audio-end event at 176.8013 seconds and exactly one result each. Playback was not accelerated.
- Source-clock checks for both charts: target 5.144 / 90.030 / 168.099 seconds; dispatch error 6.67 / 0.67 / 1.00 ms. Physical device latency is not measured.
- Browser checks pause within a live hold on both charts, freeze the audio clock and resume through 3–2–1. Focused checks confirm re-gripping across repeated pause/resume preserves a hold; leaving its key released fails. Unit tests cover early release, missed heads, exact tail completion, once-only score and full-chart head/tail event playback.
- Initial Medium verification exposed floating-point subtraction reporting an exact tail a few ulps early. A regression test reproduced it; tail comparisons now use the existing timing convention's 1e-9-second rounding tolerance. A real 1 ms early release still fails. Final full runs both pass.
- Neon Pulse registration/login/play/save/Leaderboard/Profile, two-account Like/Love/chat, Settings persistence and independent volumes, note speeds and Exit Song all passed.
- Updated screenshots and concise logs are in ignored artifacts/native-holds-final-*.log and artifacts/full-{medium,hard}-*.png. No dependencies were added.

## 2026-11-23 — Production deployment

- Live: https://beatsync-37390.web.app; project beatsync-37390; Web app 1:807042408332:web:f41456beff32a26ca240a9.
- Created the project's first Firestore Standard/Native database in the requested available Bangkok region (asia-southeast3). API reported freeTier=true; Cloud Billing reported billingEnabled=false. No existing database/data was overwritten and no service-account key was created.
- Email/password Auth deployed successfully. Final Hosting + Firestore rules/indexes deployment completed successfully. SPA /play route serves the app.
- Production build passed. Only generated original Neon Pulse WAV and user-authorized Clcik.mp4 were published. Both live audio hashes match local originals. The unapproved Foxfire WAV URL returns the SPA HTML, not audio. Monitoring MP3 was never copied/uploaded.
- Catalog metadata lives in Firestore songs/neon-pulse-v1 and songs/monitoring. Seed writes are create-only; existing documents are preserved. Production config is ignored .env.production; Emulator mode/alias remains available.
- Final local checks: **19 unit/rules tests passed** (12 game + 7 rules), **4 focused browser tests passed** (hosted flow/comments, Settings, Back navigation, keypress/mute). No full-song autoplay was run.
- Final live Chrome check: **1 passed (55.7s)**. Two QA accounts registered/logged in; Neon Pulse loaded automatically from Hosting; one keypress scored 1,000 and the demo finished naturally. Verified saved score, Leaderboard, Profile after reload, Like/Love, two-account realtime chat, comment create/edit/delete, and absence of other-user edit/delete controls.
- Online test waits were increased from Emulator-oriented 5 seconds to 20 seconds for real-network account creation and Firestore refresh; application behavior was unchanged. Earlier live attempts reached signup/refresh timeout assertions, and the final complete run passed.
- Security tests deny unauthorized profile reads/writes, score ownership/total mutations, catalog writes, comment ownership changes/oversized text/missing parents, and other-user reaction deletion. Scores remain immutable, shape-validated client submissions, not authoritative anti-cheat. No trusted backend/billing was added.
- Clearly named QA accounts and demo test score/chat records remain from live verification. Tests use runtime-random passwords, never committed. Generated logs/traces are ignored by Git.

## 2026-11-23 — Restore hold heads as taps (live verified)

- Restored all original osu! set 2299124 heads: Medium 1,559 and Hard 2,217. Compared every lane/head timestamp directly with the archive. No note has endTime; heads are single taps. Hard remains default.
- Root cause: the importer removed whole hold objects. Source UI, generated metadata, production Firestore counts and deployed v3 charts retained the reduced 284/2,051 counts. The importer now drops only tail data. Generated catalog counts derive from the chart files.
- Updated only songs/monitoring counts.medium/counts.hard with an update-time precondition and field mask; other catalog fields and user data preserved. Hosting-only deployment succeeded to beatsync-37390. Chart fetches revalidate; live v4 JSON returns no-cache, max-age=0.
- Before the usage-limit interruption: production build passed, 2 focused chart tests passed, and 3 focused local browser checks passed. These were not rerun on continuation.
- After continuation: read-only production checks confirmed Firestore 1559/2217, live chart HTTP 200, matching totals, zero holds, and v4 IDs. No redeployment or additional cloud writes were needed.
- Pending live tests: 2 passed (30.5s). Both difficulties display the correct count, load the exact expected notes, and award 1,000 immediately after pressing/releasing the first formerly-held head. No hold body is drawn and no active hold hint appears. Short rounds were exited; no full-song autoplay or score writes. Monitoring audio remains local and was not uploaded.

## 2026-11-23 — Six-song selection integration deployed

- Cause: the four imported songs were bundled behind one local-song dropdown, the prior import build had not been deployed, and the metadata generator still emitted only Neon Pulse/Monitoring.
- Added six visible/selectable cards, per-song titles/artists/difficulty-star-count badges, and matching generated cover displays. Reused the existing local-file, Play and difficulty state paths. Monitoring Medium/Hard and all eleven explicit imported assignments are preserved.
- All 11 imported chart files remained byte-identical; no re-import/regeneration. Static production audio still contains only Clcik.mp4 and original Neon Pulse WAV.
- Production build passed. New focused local integration test: 1 passed (37.7s), loading all 11 chart/audio pairs, verifying Rabbit Hole switches recordings, and one successful head tap per new song. No full-song autoplay or previously passed import/rules suites rerun.
- Seed preserved neon-pulse-v1/monitoring and created only yuusha, hibana, mesmerizer, rabbit-hole. Hosting-only deployment to beatsync-37390 completed successfully. No user data/rules/billing changed.
- New focused live selection check: 1 passed (11.6s). All six cards, titles/artists/covers, assigned difficulty labels/star ratings/note counts and local file requirements verified at https://beatsync-37390.web.app.
- Read-only production checks: all six Firestore documents match prepared metadata; all 11 live chart hashes match the unchanged originals. Screenshots/logs are in ignored artifacts/six-song* and artifacts/six-songs-* files.

## 2026-11-24 — Rabbit Hole Hard uses original normal-speed chart

- Active catalog: Hard only, displayed 4.00★, references the unchanged original x1.0 asset (BeatmapID 4508345; legacy rabbit-hole-lunatic.json filename). Lunatic is removed from selectable options. Results use the selected catalog label.
- Timing/source check passed: all 2,210 original x1.0 heads/lanes/chords match exactly at millisecond precision, with no endTime fields. No chart was regenerated, rescaled or deleted; hash verification confirmed every chart file unchanged. Other-song metadata was unchanged.
- Normal audio is the matching archive audio.mp3, 159 seconds; the prior x0.9 recording was 176.666984 seconds. Chrome verified playbackRate=1 with the normal recording and successful immediate-release tap scoring.
- Production build passed. Focused unit test passed; Rabbit Hole-only local browser test passed (14.3s); live browser test passed (17.3s). No full-song autoplay or unrelated suites.
- Updated only Rabbit Hole's charts/audioFilenames/counts/labels/stars metadata maps with an update-time precondition; other fields and all user data/scores preserved. Hosting deployment succeeded to beatsync-37390; live URL https://beatsync-37390.web.app.
