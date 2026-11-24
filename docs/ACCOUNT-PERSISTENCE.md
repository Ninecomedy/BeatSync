## User data persistence

Run `npm run emulators`, then `node scripts/seed-emulator-catalog.mjs` in another terminal before trying local song score saving. This localhost-only seed creates missing song metadata, leaving existing documents unchanged. Run `npm run dev` to open the game.

Settings are private per UID. On first login, a transaction migrates local preferences only if the cloud document does not exist. Existing cloud settings win. Saves also retain a UID-scoped device fallback; retry Save Changes after reconnecting if cloud synchronization fails.

Completed rounds save scores by song and difficulty. Leaderboards filter by both, while Profile shows the highest score across songs. Existing Neon Pulse scores without a difficulty remain visible. Rules check owner identity, arithmetic and note totals against admin-managed metadata. This is not server-authoritative anti-cheat.

Public source excludes recordings and credentials. Generate the original Neon Pulse audio with `node scripts/generate-hosted-demo.mjs`; obtain other audio legally and use the local picker. No audio is uploaded. Private profile thumbnails use bounded Firestore fields, not a billed Storage bucket.
