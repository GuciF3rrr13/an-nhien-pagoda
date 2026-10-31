# Viewer engagement verification — 2026-10-31

Phases 7–9 add TikTok-native participation, per-session gratitude boards, local Vietnamese narration, simultaneous-audience milestones and sharing acknowledgments. Terra handled bounded backend work, Luna handled client/UI work, and Sol reviewed complex persistence/event/audio integration. The parent agent integrated and verified each phase before starting the next.

## Behavior and contracts

- Free commands: `!le`, `!nhang`, moderated `!cau`. `!sen` returns gift guidance without points or consuming command cooldown. Gifts retain mapped contributions and exact-once streak deltas.
- `Snapshot.session`: durable session identity/source/start time plus top-five gift-point and free-participation boards. All contributing users retain scores; pending/rejected prayers, replay and mismatched sources do not score. Approval credits only the original matching session.
- `POST /api/session/new`: resets session boards/audience/announcements, preserving lifetime progress, settings, mappings and prayers. Same-source reconnect after a restart preserves saved boards. Operators explicitly begin a new session for a new LIVE.
- `Snapshot.announcements`, narrator settings and local WAV endpoints: trusted Vietnamese templates, sanitized names, final-streak thanks, one voice at a time, maximum 12 queued items and 20-second client freshness. Music ducks to one quarter of its configured gain during narration and recovers on completion, disable, error or cancellation. Preview remains silent; reload/audio activation skips existing announcements.
- `audience` events have no user and cannot create visitors or offering points. SDK v3 `roomUser.total` supplies concurrent viewers; cumulative `totalUser` is intentionally excluded. Current count becomes unknown after 30 seconds, disconnect or restart; durable peak and reached milestones survive reconnect.
- Audience thresholds: 100/250/500/1,000 then each 1,000. Large jumps show the highest new ceremony; durable peak prevents repeating after dips. Bounded history keeps 64 thresholds. The original 40 visitors and 180 pooled effects remain the maximum.
- Received shares show thanks; voice throttles the same viewer to once per minute. Server share invitations require a connected matching source and fresh positive audience count, run at most every five minutes, and wait 20 seconds after audience celebrations. No TikTok messages are posted.

## Checks run

- **20 unit/integration tests passed**, including SQLite recovery, sequenced WebSocket views, cooldowns, moderation, exact-once gifts, session scoring/recovery/reset, source isolation, narration grouping/queue recovery, SDK fixtures, audience dips/huge jumps and invitation timing.
- **14 browser tests passed; benchmark skipped intentionally in that suite.** Browser coverage includes game/overlay/admin synchronization, reconnect, prayer privacy, durable mappings/settings, simulator, invalid/origin rejection, audio activation, leaderboard/source/reset flows, audience effects/counts, real Vietnamese WAV response, serial voice/ducking/disable, OBS-style auto-audio, session changes and bootstrap suppression.
- TypeScript and production build passed. Existing Vite chunk-size advisory remains; it does not fail the build.
- Updated native wide/close and desktop/mobile baselines were generated for the intentional interface changes, inspected, then reproduced by the final suite without snapshot updates. Golden altar/artwork remain intact; the new board and instructions use the established gold/brown and ivory/jade visual system. Long-name/top-five and 390px mobile captures are in `engagement-portrait.png` and `engagement-mobile.png`.
- `audience-1000.png` shows the new celebration with a fixed visual clock, all 40 visitor objects, communal bow and pooled petals. Transient acknowledgments do not stack duplicate spoken/visual text; capture mode omits them for stable baselines.
- Native `Linh` synthesis produced a 3.54-second, mono 22,050Hz WAV with nonzero signal (RMS 4349.7 at 16-bit scale). `narration-sample.wav` is a generic-name listening sample. Browser tests also received a real RIFF/WAVE response from the server endpoint.
- Sol review found two concrete issues and both have regression coverage: persisted LIVE boards clearing on reconnect after restart, and inherited command keys such as `constructor` resolving as actions. Final targeted review found no further concrete event/session/narrator issue.
- Performance benchmark passed: 60.033 seconds, 40 visitors, peak 180 effects, gift bursts every 700ms and increasing audience milestones every 4.9s; mean 61.68 FPS, minimum complete 60-frame window 59.94 FPS, p95 frame time 17.6ms. Apple M5 / ANGLE Metal / production 1080×1920. See `benchmark.json`. Existing local server smoke returned HTTP 200 for health/admin/game/overlay, with the new contracts and Linh available.

## Verification limits

Actual TikTok event reception, actual OBS Studio audio/capture, broadcasting and subjective listening have not been exercised. Narration currently uses the installed macOS Linh voice; unsupported/missing native voices report unavailable and retain visual acknowledgments. Browser auto-audio was tested with an OBS-like autoplay policy, which does not establish actual OBS capture. The performance test isolates local rendering and excludes narration/OBS encoding.
