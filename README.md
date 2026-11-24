# BeatSync

เกม Rhythm สำหรับวิชา Web Programming พัฒนาด้วย HTML, CSS และ JavaScript (ES Modules) ใช้ Vite สำหรับรันและ build โดยไม่มี UI framework ใช้ Firebase Authentication แบบ Email/Password และ **Cloud Firestore เป็นฐานข้อมูลเพียงตัวเดียว**

## รันในเครื่อง

ต้องมี Node.js 22.12+ หรือ 24, Java 21+ และ Google Chrome สำหรับ browser tests

```sh
npm ci
npm run emulators
```

เปิด terminal อีกหน้าต่าง:

```sh
npm run dev
```

เปิด http://127.0.0.1:5173 และ Emulator UI http://127.0.0.1:4000 ค่าเริ่มต้นเป็น `demo-beatsync` ไม่มีการเชื่อม Firebase production ไม่ต้องใส่ API key หรือ service account สมัครบัญชีทดสอบผ่านหน้า Register ได้เลย ข้อมูล Emulator จะหายเมื่อหยุด ถ้าต้องการเก็บให้ใช้ Firebase CLI export/import ตามคู่มือ Emulator

ตั้ง `JAVA_HOME` ให้ชี้ JDK 21+ หาก Java ไม่อยู่ใน PATH ตัว launcher รองรับ Android JDK ที่ `C:/Program Files/Android/openjdk/jdk-21.0.8` ที่พบในเครื่องพัฒนานี้ด้วย การรันครั้งแรกต้องใช้อินเทอร์เน็ตดาวน์โหลด Emulator

## ฟีเจอร์รอบแรก

- Register: ชื่อผู้เล่น 1–24 ตัวอักษร อีเมล รหัสผ่านอย่างน้อย 6 ตัวอักษร และยืนยันรหัสผ่าน สมัครแล้วกลับ Login ตามเส้นทางทดสอบ
- Login: ใช้อีเมล; Firebase Auth จัดการรหัสผ่าน ไม่มีการเก็บรหัสผ่านหรืออีเมลใน Firestore
- Start Game: เปิด Song Selection ตาม Figma 29:84 มี Neon Pulse หนึ่งเพลง กด ▶ เพื่อเริ่มเกมด้วยเสียงและ Beatmap เดิม
- เพลงเดโม: Neon Pulse 120 BPM ความยาว 27 วินาที มี 48 โน้ตที่กำหนดล่วงหน้าใน JSON
- กด **D F J K** ตามช่อง หรือแตะปุ่มล่าง จังหวะอ้างอิง `AudioContext.currentTime` เดียวกับเสียง ใช้ `requestAnimationFrame` วาดภาพเท่านั้น
- Perfect ภายใน ±60 ms ได้ 1,000; Good ภายใน ±150 ms ได้ 500; Miss ได้ 0 และ reset combo คะแนนสูงสุด 48,000 ไม่มีโบนัส combo
- กดค้างไม่ทำให้ยิงซ้ำ; Pause/Resume หยุด audio clock; สลับแท็บแล้ว pause อัตโนมัติ; Quit ไม่บันทึกคะแนน
- โน้ตเป็นวงกลมเรืองแสงกลางแต่ละช่อง ใช้กึ่งกลางวงกลมตัดเส้นที่เวลาโน้ตเดิม ไม่มีการเปลี่ยน hit window
- จบเพลงแล้วบันทึกคะแนนด้วย run ID เดิม การ Retry หลัง acknowledgment ไม่ชัดเจนไม่สร้างคะแนนซ้ำ
- Leaderboard แสดง **20 รอบคะแนนสูงสุด** เรียงจากมากไปน้อย (ผู้เล่นหนึ่งคนมีหลายรอบได้) ทุกแถวมี `data-score-id`
- Like และ Love เปิด/ปิดได้แยกกันต่อ UID; จำนวนคำนวณจาก reaction documents ไม่เปิดให้ client แก้ยอดรวม
- Live Chat ใต้ Leaderboard ฟัง 50 ข้อความล่าสุดแบบ real-time ข้อความยาวไม่เกิน 280 ตัวอักษร แสดงข้อความเป็น text ที่ escape แล้ว
- Profile แสดงชื่อจาก `profiles/{uid}` และคะแนนสูงสุดจาก query คะแนนจริง ไม่เก็บตัวเลขสูงสุดซ้ำให้ข้อมูลคลาดเคลื่อน

## โครงสร้าง

```text
index.html
src/
  main.js                 entry point
  styles.css              responsive Figma styling
  ui/app.js               screens, forms, navigation, subscriptions
  game/engine.js          pure judgement/scoring logic
  game/audio.js           original synthesized audio buffer
  game/player.js          audio clock, input, canvas, lifecycle
  firebase/client.js      config and explicit emulator wiring
  firebase/service.js     auth, reads, writes, transactions, listeners
public/
  beatmaps/neon-pulse.json fixed beatmap, seconds and lanes 0–3
  assets/                 local Figma assets
firestore.rules
firestore.indexes.json
tests/                    unit, Rules and two-account browser tests
docs/                     test report and next-round Comment contract
```

## ตั้งค่า Firebase โปรเจกต์ทดสอบจริง

1. สร้าง/เลือก Firebase **test project** และ Web app ใน Console
2. เปิด Authentication → Sign-in method → Email/Password
3. สร้าง Cloud Firestore **Standard edition / Native mode** และเลือก region ที่ทีมตกลงกัน โค้ดนี้ใช้ standard modular SDK และ Security Rules ไม่ใช้ Realtime Database
4. คัดลอก `.env.example` เป็น `.env.local` ตั้ง `VITE_USE_EMULATORS=false` แล้วกรอก Web app config ทั้ง 4 ช่องจาก Console
5. ตรวจ Authentication → Settings → Authorized domains ให้มี `localhost` และโดเมนทดสอบ (ไม่มี protocol หรือ port)
6. Login Firebase CLI แล้ว deploy เฉพาะ Firestore Rules/indexes ไปยัง test project ที่ระบุชัดเจน:

```sh
npx firebase login
npx firebase deploy --only firestore:rules,firestore:indexes --project YOUR_TEST_PROJECT_ID
npm run build
npm run preview
```

รอ composite index `scores(uid ASC, score DESC)` สร้างเสร็จก่อนทดสอบ Profile ค่าเริ่มต้นของ tests ใช้ Emulator; ดูการตรวจ production ด้านล่าง

Firebase Web config เป็นข้อมูลฝั่ง client และอยู่ใน bundle ได้ ไม่ใช่ server secret ตัว `.env.local` ยังถูก ignore เพื่อแยกค่าของแต่ละคน **ห้ามใส่ service account, Admin SDK credentials, private keys หรือ server secrets ใน `VITE_*`, public/ หรือ Git** งานนี้ไม่ต้องใช้ service account

## Data model และสิทธิ์

| Path                                    | ข้อมูล                                                                     | สิทธิ์                                              |
| --------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------ |
| `profiles/{uid}`                        | name, createdAt                                                          | สมาชิกอ่านชื่อเกมได้; เจ้าของสร้าง; ไม่มีอีเมลหรือข้อมูลส่วนตัว |
| `scores/{scoreId}`                      | uid, playerName, songId, score, maxCombo, perfect, good, miss, createdAt | สมาชิกอ่าน; เจ้าของสร้าง; แก้ไข/ลบไม่ได้                |
| `scores/{scoreId}/reactions/{uid}`      | like, love, updatedAt                                                    | สมาชิกอ่านเมื่อ parent มีจริง; เจ้าของ UID เขียนได้เท่านั้น  |
| `messages/{messageId}`                  | uid, playerName, text, createdAt                                         | สมาชิกอ่าน; เจ้าของสร้าง; แก้ไข/ลบไม่ได้                |
| `scores/{scoreId}/comments/{commentId}` | สงวนสำหรับรอบถัดไป                                                         | ปิด read/write ในรอบนี้                             |

Rules ตรวจ owner, schema, types, ความยาว, timestamp และความสอดคล้องของผลคะแนน รวมทั้งตรวจชื่อผู้เขียนกับ profile จริง ผู้ไม่ login เข้า collection ไม่ได้ ข้อมูลเกมทั้งหมดอยู่ Firestore; Firebase Auth ใช้จัดการบัญชีและ session เท่านั้น

**ข้อจำกัดคะแนน:** เกมทำงานใน browser จึงยังปลอมผลการแข่งขันที่ผ่าน schema ได้ด้วย client ที่ดัดแปลง Rules ตรวจได้ว่าข้อมูลและเจ้าของถูกต้อง แต่พิสูจน์การกดปุ่มจริงไม่ได้ เหมาะกับงานเรียน/โปรเจกต์ทดสอบ หากใช้แข่งขันจริงต้องเพิ่มการตรวจ replay ฝั่ง trusted backend โดยยังคง Firestore เป็นฐานข้อมูล

I've set up prototype Security Rules to keep the data in Firestore safe. They are designed to be secure for account-owned writes, strict schemas, bounded values, immutable scores and UID-scoped reactions. However, you should review and verify them before broadly sharing your app. If you'd like, I can help you harden these rules.

## ทดสอบ

```sh
npm test                    # pure engine, no emulator needed
npm run test:integration    # starts/stops emulator and runs Rules tests
npm run test:all            # starts/stops emulator: engine + Rules + Chrome + build
```

หยุด Emulator ที่รันเองก่อนใช้ `test:integration` หรือ `test:all` เพื่อไม่ให้ port ชน หากเปิด Emulator อยู่แล้ว:

```sh
node --test tests/firebase.test.js
npm run test:browser
```

Browser tests เปิดสอง Chrome contexts แยก session สมัครและ login จริง เล่นครบ 27 วินาทีผ่าน keyboard events ตาม audio clock (ไม่ข้ามเวลา ไม่เขียนผลคะแนนผ่าน test API) ตรวจ score, Profile, reaction toggle, แชตสองทาง, XSS escaping, reload, logout, validation, mobile overflow และ pause/quit ภาพหน้าจออยู่ `artifacts/` รายงานอยู่ `playwright-report/` (ไม่ commit ข้อมูลทดสอบ)

Rules tests ใช้ namespace `demo-beatsync-rules` แยกจากข้อมูลหน้าเว็บและล้างเฉพาะ namespace ทดสอบนี้ รันซ้ำได้ โดย Emulator อาจแจ้งเตือน multiple project IDs ซึ่งเป็นการแยกข้อมูลโดยตั้งใจ

ทดสอบมือ: สมัคร A → Login → Start → เล่นจนจบ → View Leaderboard → Profile แล้วเปิด incognito สมัคร B เพื่อกด Like/Love และส่งข้อความ สลับดู A ว่าอัปเดตโดยไม่ refresh ทดสอบเสียงด้วยหูฟังและความหน่วงคีย์บอร์ดจริงก่อนส่งด้วย

ผลที่รันจริงและข้อจำกัดอยู่ใน [docs/TEST-REPORT.md](docs/TEST-REPORT.md)

## Figma และงานรอบถัดไป

อ้างอิง [Figma ของทีม](https://www.figma.com/design/o4oXXBt7nKo6jKhs5N0iRy?node-id=0-1) ใช้พื้นหลัง โลโก้ ไอคอน trophy/profile/send และ record จากไฟล์ทีมเป็น local assets โดยแปลง layout ให้ responsive ไม่มี React/Tailwind dependency ที่ติดมากับ prototype

ส่วนที่ปรับตามขอบเขตรอบแรก: ใช้ Email/Password แทน Google login; ใช้เสียง/ปก Neon Pulse ของเดโมแทนเพลงศิลปิน; avatar ใช้อักษรชื่อจริง; Profile แสดง highest score แทน XP/About Me ที่ยังไม่อยู่ใน scope Settings เพิ่มแล้วตามรายละเอียดด้านล่าง

เสียง Neon Pulse สร้างขึ้นใน `audio.js` ด้วย sine tones และ kick synthesis ไม่มี recording หรือ sample เพลงภายนอก ทีมสามารถใช้เสียงเดโมนี้ในงานได้ ส่วนสิทธิ์ภาพ Figma ให้ทีมตรวจตามที่มาของไฟล์ต้นฉบับ

**Comment ยังไม่ได้เปิดใช้งานในรอบนี้** ตามคำขอให้รอแบบ UI ต้องทำและผ่าน acceptance ก่อนส่งอาจารย์ ดู [docs/COMMENTS-NEXT.md](docs/COMMENTS-NEXT.md)

## ตรวจรูปแบบและ build

```sh
npm run format:check
npm run build
```

`npm audit --omit=dev` ผ่านโดยไม่มีช่องโหว่ ณ รอบทดสอบนี้; dependency เครื่องมือพัฒนา Firebase CLI ยังมี advisory ระดับ moderate 14 รายการ (ดูรายงาน) ไม่มี high/critical คงเหลือ ไม่ควรใช้ `npm audit fix --force` โดยไม่ตรวจ breaking changes

## เพลงเต็มจากไฟล์ในเครื่อง: モニタリング

Song Selection offers Neon Pulse and モニタリング. Monitoring has exactly two native osu!mania difficulties; **Hard is preselected**.

| Difficulty | Original chart | Stars | Objects | Holds |
| --- | --- | ---: | ---: | ---: |
| Medium | [4K] anatha's going insane | 3.43★ | 1,559 | 0 |
| Hard | [4K] Insane | 3.86★ | 2,217 | 0 |

For either difficulty, select `C:\Users\pikac\Downloads\2299124-BeatSync\audio.mp3` extracted from archive 2299124. Both charts reference this same `AudioFilename`; the browser checks its SHA-256 and reads it locally without uploading. Switching difficulty reuses the selected file. Refreshing requires selecting it again.

After four seconds of preparation, the complete **2:56.800** local audio plays from 0:00. Hold starts are restored as single taps; every original head keeps its lane and timestamp, and no tails are included. Pause and the 3–2–1 resume countdown freeze playback and judgment. Results remain local to the round; Neon Pulse saves to Leaderboard/Profile.

Import details: [docs/OSU-IMPORT.md](docs/OSU-IMPORT.md). Older synthetic and tap-adaptation JSON files are retained as historical artifacts and are not selectable.

เปิด PowerShell สองหน้าต่างที่ `C:\WebPro`:

```powershell
cd C:\WebPro
npm run emulators
```

```powershell
cd C:\WebPro
$env:VITE_USE_EMULATORS='true'
npm run dev
```

เปิด http://127.0.0.1:5173 สมัคร/เข้าสู่ระบบ แล้ว Start Game → เลือกไฟล์เพลง → ▶

ทดสอบรวมกับ MP3 จริง (ไฟล์ยังอยู่ในเครื่อง):

```powershell
$env:VITE_USE_EMULATORS='true'
$env:BEATSYNC_OSU_AUDIO='C:\Users\pikac\Downloads\2299124-BeatSync\audio.mp3'
npm run test:all
```

หากไม่ตั้งตัวแปรไฟล์เสียง ระดับที่ไม่มีไฟล์จะ skip; ตั้งทั้งสองตัวเพื่อทดสอบครบสามระดับ
รายละเอียดการวิเคราะห์อยู่ใน docs/LOCAL-AUDIO.md

## Settings

กดไอคอนเฟืองที่ Start หรือ Song Selection เพื่อเปิด Settings

- Note Speed: 0.5×–2× เปลี่ยนเวลาเดินทางของโน้ต แต่เวลาแตะเส้นและช่วงรับปุ่มคงเดิม
- Music Volume และ SFX Volume: แยกระดับเสียงเพลงกับเสียงตอบรับเมื่อกดโน้ตถูก
- Key Bindings: คลิกช่อง Lane แล้วกดปุ่มใหม่ รองรับตัวอักษร ตัวเลข ลูกศร และเครื่องหมาย ปุ่มซ้ำจะถูกปฏิเสธ
- Save Changes: บันทึกในเบราว์เซอร์และใช้ในเกมถัดไป แม้รีเฟรชหน้า
- Reset to Default: บันทึกค่าเริ่มต้นทันที (1×, Music 100%, SFX 50%, D F J K)

การทดสอบเต็มเพลงสามระดับใช้เวลาประมาณ 10 นาที โดยไม่เร่งหรือข้ามเสียง
รายละเอียดการวิเคราะห์และข้อจำกัดการเข้าถึงแบบ Settings ใน Figma อยู่ใน docs/LOCAL-AUDIO.md

## Gameplay pause and hit targets

- Resume shows **3 → 2 → 1**, one second per number. AudioContext stays suspended, notes stay frozen, and key/pointer judgments are ignored until the countdown finishes. Audio resumes on the same source and timestamp, without restarting or changing its origin.
- **Cancel resume** returns to PAUSED. Leaving the tab cancels a countdown and remains paused; quitting cleans up its timers and closes audio.
- PAUSED, countdown numbers, GET READY, PERFECT, GOOD and MISS are centered on the viewport. The larger combo is directly beneath hit feedback and hidden during pause/countdown overlays.
- Buttons sit 32 px above the lane bottom. Each falling circle is 70% of its button's diameter and uses that button's DOM center as its exact-time target. There is no separate judgment line.
- Note Speed affects travel only. Existing Perfect (±60 ms), Good (through ±150 ms) and Miss windows are unchanged; the existing engine calls the intermediate judgment GOOD.
- Browser coverage includes repeated resume cycles near a note, canceled/abandoned countdowns, ignored keyboard/pointer hits during countdown, and target alignment at 0.5×, 1× and 2× with desktop and mobile layouts.

### Exit Song

Use **Exit Song** from gameplay or while paused/counting down to return directly to Song Selection. The current song, difficulty and decoded local audio stay selected for replay. Playback and countdown timers stop immediately; unfinished runs are discarded without a result or score save. You can start another song from the same screen.


## Production deployment (2026-11-23)

- Live site: https://beatsync-37390.web.app — Firebase project `beatsync-37390`.
- Firestore `(default)`: Standard / Native, Bangkok `asia-southeast3`. Billing remains disabled.
- Email/password Auth, Firestore, and classic Hosting only; no Realtime Database or Storage.
- Neon Pulse automatically loads its static WAV and chart using `songs/neon-pulse-v1` metadata. The WAV is generated from the existing original synthesizer. Clcik.mp4 is published with the user's permission. The Foxfire WAV is excluded from production output/Hosting. Monitoring audio is not published; Medium 1,559 / Hard 2,217 remain tap-only local-file charts, Hard preselected.
- `songs/monitoring` records local-file mode, chart paths, counts and default difficulty. Browser clients cannot modify catalog documents. `scripts/seed-song-catalog.mjs` creates missing catalog documents only and preserves existing data.
- Click a score row (or focus it and press Enter) to read/post comments. Owners can edit/delete their comments. Names/text are escaped before rendering.

Keep production SDK values in ignored `.env.production` (the same four VITE_FIREBASE fields as `.env.example`, with VITE_USE_EMULATORS=false). Keep `.env.local` for Emulator development. No service-account keys are needed; deployment and catalog seeding use the existing Firebase CLI login.

```powershell
cd C:\WebPro
npm run build:production
node scripts/seed-song-catalog.mjs
node node_modules/firebase-tools/lib/bin/firebase.js deploy --only 'hosting,firestore:rules,firestore:indexes' --project beatsync-37390
```

`build:production` forces real Firebase configuration, checks the project ID, generates the original demo WAV, and includes only authorized audio. The `production` project alias is available; the default alias remains demo-beatsync for local development.

Focused online verification (creates clearly named QA accounts, a demo score and a chat message; uses random passwords that are not stored in Git):

```powershell
$env:BEATSYNC_LIVE_URL='https://beatsync-37390.web.app'
npx playwright test tests/browser/deployment.spec.js --reporter=list
Remove-Item Env:BEATSYNC_LIVE_URL
```

This check presses one note and lets the 27-second original demo finish naturally; it does not autoplay full tracks. It checks real login, automatic audio loading, score/Profile persistence, two-account reactions/comments/chat. Emulator rules tests separately cover unauthorized writes and reads.

### Security limits

Profiles are readable/editable by their owner; only public player names appear on scores, messages and comments. Auth email/password data is not stored in Firestore. Scores are immutable and validated for UID, name, chart, integer counts, total notes, points and server timestamp. Reactions and comments are owner scoped. Unknown paths and client catalog writes are denied.

These client-submitted scores are **not authoritative anti-cheat**: a modified client can submit plausible valid totals. Trusted replay verification would require a backend and a separately approved operational/billing design. Rules enforce access and data shape, not proof of gameplay. Existing records are not overwritten by deployment or catalog seeding.

## Additional local song imports

Yuusha, HIBANA, Mesmerizer and Rabbit Hole are available through Song Selection's **Local song** selector with explicitly assigned Easy/Med/Hard/Lunatic options. Monitoring still uses Medium/Hard. See [the 11-chart mapping and local audio instructions](docs/SONG-IMPORTS.md). All six songs are now visible as selectable cards on the deployed website. Audio for local tracks stays outside Git and uses the local MP3/OGG file picker.

Rabbit Hole update: only **Hard (4.00★)** is selectable, using its unchanged original x1.0 chart and normal-speed `Downloads/BeatSync-imports/2141937/audio.mp3` (159 seconds). The old Lunatic-named asset remains as an inactive historical filename; no charts or user records were deleted.


## Public source snapshot

This snapshot excludes all sound recordings, local environment files, credentials and generated build output. Original Git history remains local. Generate the original Neon Pulse demo with `node scripts/generate-hosted-demo.mjs`. Other songs require matching legally obtained audio through the local file picker. The optional Clcik sound is omitted; the built-in synthesized key sound remains available. Copy `.env.example` to configure local Firebase Emulators. Browser tests generate passwords at runtime.
