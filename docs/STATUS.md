# Project status

**Phases 0–9 are complete for the local release and requested viewer-engagement extension.** Actual TikTok reception and OBS/broadcast verification remain external setup tasks.

## Documentation update
- Moved the existing responsibility disclaimer near the top of README for visibility; its wording is unchanged.
- Clarified the educational purpose of the project and instructional video, its independent simulation status, and the author's stated absence of fundraising or financial benefit; video gift interactions are simulated.
- Clarified in both disclaimer languages that the source code is shared solely for learning and programming reference, and that each individual or organization is responsible for its use and related activities.
- Added Vietnamese and English responsibility disclaimers to README, including the unofficial TikTok connector and unverified real LIVE reception and broadcasting. No project license was asserted.
- Checks: reviewed the wording against the existing README and this status; checked the Markdown diff. Application tests were not run for this documentation-only change.
- Next: validate real TikTok reception and OBS capture/audio when a suitable LIVE session is available; desktop release workflow validation remains pending as described below.

## Desktop packaging and in-app TikTok settings (latest)
- **TikTok username + sign key now live in Admin → Cài đặt** (`GET/PUT /api/tiktok`, SQLite `config` table, additive, `user_version` unchanged). Key is write-only; neither it nor the username is in any snapshot. `.env` values remain a fallback. **Decision:** this deliberately supersedes the earlier "credentials in ignored env files" contract (user-approved); AGENTS.md updated.
- **Bun desktop executable:** `npm run package` → `scripts/build-desktop.ts` embeds `dist/web` and compiles `apps/server/src/desktop.ts` (data dir per OS, embedded static + Range, reuse-if-running, auto-open browser). Bun 1.4.4 runs `node:sqlite`, express/ws and `tiktok-live-connector` unchanged, so no SQLite adapter was added; dev/tests remain on Node.
- **CI:** `.github/workflows/build.yml` — test job, native-runner matrix (macOS arm64, macOS Intel, Windows x64) with `scripts/smoke-desktop.mjs`, tag `v*` → GitHub Release with checksums. Actions pinned by SHA; no secrets.
- Checks run: `tsc` clean; `npm test` 23/23 (3 new credential tests); Settings UI saved/persisted in a real browser (isolated instance on a scratch DB); under Bun: server, WS snapshot, SDK import behave like Node; compiled **macOS arm64** binary passed the smoke test from an empty directory (assets, Range 206, WS, DB in data dir, persistence, second-instance reuse, busy-port fallback). `actionlint` clean. Windows and Intel binaries cross-compiled only.
- **Unverified:** the GitHub workflow has not run yet (first push/`workflow_dispatch` is the test); Windows and macOS Intel executables have not been run; binaries are unsigned/unnotarized; no new Playwright test for the Settings form (covered by API tests plus manual browser check); real TikTok reception still unverified.
- Next: push, run the workflow via `workflow_dispatch`, fix any runner-specific failure, then tag `v0.1.0`.

## Local startup convenience
- Added a root Makefile for setup, development, production build/start, tests and help; README documents TikTok configuration and connection. Setup preserves an existing `.env`.
- Verified Make target commands and setup creation/preservation using a stubbed npm in a temporary directory; `make test` passed 20 tests, `make build` passed with the existing Vite chunk-size advisory, and an isolated `make run` returned HTTP 200 for `/admin` and `/game`. The first test attempt hit a sandbox IPC restriction; rerunning outside the sandbox passed.
- Next: run `make setup`, set TikTok credentials in `.env`, run `make`, and connect via admin. Real LIVE events and OBS broadcasting remain unverified.

## Delivered
- Phaser 4.2.1 / React / TypeScript / Node 24 / SQLite npm workspace; backend-owned events/progress and sequenced WebSocket synchronization across `/admin`, `/game`, `/overlay`.
- Approved golden painted temple, independent altar/visitor art, wide/close cameras, 40 visible visitors and 180 pooled effects. Existing visual identity and original artwork are preserved.
- Free `!le`, `!nhang`, moderated `!cau`; flower offerings require TikTok gifts. `!sen` gives gift guidance without points/cooldown. Exact-once gift streak contributions and durable settings/mappings/events/prayers remain intact.
- Durable per-session **Bảng tri ân**: gift contribution points and free participation, top five each. Approved prayers score only in their original matching session; replay and mismatched sources do not score. Explicit session reset preserves lifetime progress/settings/prayers. Reconnecting to the same persisted source preserves boards.
- Vietnamese narrator uses the installed macOS **Linh** voice, synthesized to WAV server-side, played through the browser/OBS audio graph. Bounded serial voice queue, grouped gift thanks, follow/share thanks, independent volume, music ducking, silent admin preview and bootstrap/reload suppression. Missing voice retains visual thanks.
- Separate simultaneous-audience counter and once-per-session milestones at 100/250/500/1,000 then each additional 1,000. Tiered lotus/light effects and communal bow; dips/reconnects do not repeat reached thresholds. Unknown count after disconnect/restart/30 seconds without new stats. Share invitations at most every five minutes with fresh positive audience data, spaced from celebrations.
- Admin mock controls for gifts, audience and shares; truthful source labels and noninteractive TikTok instructions in stream. SDK adapter supports share and `roomUser` statistics (`total`, never cumulative `totalUser`). No messages are posted to TikTok.
- Existing looping `music.mp3` remains on the ambient control with linear gain (default 8% after master), separate ceremony and narrator controls. README covers usage, sessions, OBS, backups and voice limitations.

## Validation — latest extension
- **20 unit/integration tests pass** with the normal `npm test` command. Includes persistence/sync, cooldown/moderation, exact-once scoring/streaks, session recovery, narrator queues, audience/source/threshold/SDK fixtures and share-prompt timing.
- **14 browser tests pass**, with the benchmark intentionally skipped in the normal suite. Includes real Vietnamese WAV response, serial voice/ducking/disable, OBS-like auto-audio, bootstrap/session resets, boards, audience effects and synchronized operator flows.
- TypeScript and production build pass. Existing Vite chunk-size advisory remains. Existing local server returns HTTP 200 for health/admin/game/overlay and exposes the new contracts; narrator reports Linh available.
- Updated wide/close, desktop/mobile baselines inspected and reproduced without snapshot updates in the final suite. Native 1,000-viewer celebration and top-five/long-name mobile captures inspected. See `docs/qa/ENGAGEMENT_REVIEW.md` and `audience-1000.png`.
- **60-second hardware performance passes:** 40 visitors, gifts every 700ms, audience celebrations every 4.9s, peak 180 effects at 1080×1920. Mean **61.68 FPS**, slowest complete 60-frame window **59.94 FPS**, p95 **17.6ms**; Apple M5 / 10 cores / 24GiB / ANGLE Metal. Audio/OBS encoding excluded. See `docs/qa/benchmark.json` and `PERFORMANCE.md`; original v1 measurement retained in `benchmark-release-v1.json`.
- Generic-name native Vietnamese sample: `docs/qa/narration-sample.wav`, 3.54s mono 22,050Hz, nonzero waveform. Speech pronunciation/loudness has not been subjectively assessed.
- Terra implemented bounded backend tasks, Luna implemented client/UI, Sol reviewed complex event/session/narrator integration. Two review findings fixed with regression tests: saved TikTok boards resetting after restart/reconnect, and inherited command names such as `constructor` causing exceptions. Final targeted review found no further concrete issue.

## Phase boundaries and failures
- Phase 7 gate passed before narration: 13 unit/integration tests, eight browser checks and native/mobile inspection.
- Phase 8 gate passed before audience effects: 16 unit/integration tests, real WAV and browser narration/session/OBS-like audio checks. Fixed first-gift loss after session reset and narration enabled before initial state.
- Phase 9 gate passed with the final checks above. A concurrent Playwright output collision and one incorrect simulator-label test selector were corrected; final suites pass. Run browser suites/benchmark sequentially.

## Limits and next concrete action
- Real LIVE reception, actual gift IDs, OBS Studio capture/audio, broadcasting and subjective audio listening remain unverified. Current LIVE access is phone-only. No software-rendered or universal-hardware performance claim is made.
- Native narration currently targets macOS with Linh; other systems report voice unavailable. Only use one audible game/OBS source to avoid double playback. Begin a new session explicitly before each new LIVE; restart/reconnect intentionally preserves the latest session.
- Existing server is running and was reused at **http://127.0.0.1:3000/admin** in mock mode, with Linh available. No duplicate server was started. Data remains in ignored `data/temple.sqlite`.
- Next: use **Chạy mô phỏng**, **Gửi quà**, **Cập nhật người xem** (e.g. 1,000), **Thử chia sẻ**; enable audio in `/game` or use `/overlay?audio=1`, then listen and balance narrator/music on the intended device. For a real broadcast, configure `.env`, map actual gifts and validate received events plus OBS capture/audio.
- Deferred: themed rooms, daily activities, OBS automation, official partner integration and cloud deployment. No additional feature implementation remains in the authorized extension.
