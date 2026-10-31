# Chùa An Nhiên LIVE — implementation plan

## Product
Complete local app with one cooperative temple, animated visitors, free commands and gift effects, shared milestones, Vietnamese React admin, SQLite, optional TikTok input, and OBS Browser Source. Phone-only TikTok LIVE access does not block local development; desktop broadcasting is an external setup dependency.

## Phases and gates
0. **Project contract:** create AGENTS, this plan, STATUS; preserve reference and selected skill revision. Gate: requirements, defaults, and next action recorded.
1. **Runnable foundation:** npm workspace, TypeScript/React/Phaser/Node/SQLite, normalized events, mock connector, REST and WebSocket snapshots. Gate: simulated event reaches game, restart persists progress, two views synchronize.
2. **Visual foundation:** art brief, representative native-scale composition, then layered temple/characters/props/effects and wide/close cameras. Gate: inspect native output and validate alpha, anchors, readability, cohesion.
3. **Complete gameplay:** enter/idle/kneel/bow/offer/leave states; commands, cooldowns, gifts, milestones, deduplication, bounded queues/pools. Gate: deterministic scenarios cover actions and milestones without duplicate contributions.
4. **Operator controls:** preview, simulator/replay, gift mappings, prayer approval, camera/audio controls, durable settings. Gate: workflows work end to end including restart and prayer approval.
5. **TikTok and OBS:** isolated optional server-side adapter, status/reconnect, portrait overlay and setup guide. Gate: fixture tests, working mock mode and OBS-compatible browser view; live verification reported separately.
6. **Release validation:** visual regression, 60-second 40-visitor gift-burst benchmark, fixes, production build and docs. Gate: sustained 30 FPS on documented development machine, acceptance checks pass, external limitations recorded.
7. **TikTok participation and Bảng tri ân (complete):** free `!le`, `!nhang`, moderated `!cau`; flower offerings require gifts. Durable per-LIVE top-five gift-support and free-participation boards, explicit new-session control, truthful mock/live labels and noninteractive stream instructions. Gift points use existing mappings; prayer participation scores only on approval; replay and mismatched sources do not score. Gate: focused engine/API persistence and exact-once scoring tests, synchronized browser workflows, native portrait/mobile inspection and production build.
8. **Vietnamese narrator (complete):** queued gift/name thanks with streak grouping, bounded queue, music ducking, independent voice controls and silent admin preview. Prefer local Vietnamese synthesis with no new account/credentials; expose actual availability and retain visual acknowledgments on failure. Gate: queue/streak/reconnect/disable tests, browser playback and ducking checks, synthesized audio inspection; subjective voice and actual OBS capture reported separately.
9. **Audience celebrations and sharing (complete):** normalize simultaneous-viewer counts and shares; 100/250/500/1,000 then each additional 1,000 viewers, once per LIVE. Separate audience counts from offering progress and visible visitor count. Tiered bounded effects/communal bow, share thanks and gentle spaced share invitations. Gate: crossing/dip/reconnect/session-reset tests, adapter fixtures, synchronized browser effects and hardware performance under 40 visitors; real LIVE reported separately.

## Interfaces and defaults
- npm workspaces: browser app, server, shared contracts. Node 24 backend authoritative; SQLite repository isolates storage. Server serves production UI and binds loopback.
- `/game` responsive portrait scene; `/overlay` no operator controls, 1080×1920 OBS; `/admin` Vietnamese operator interface.
- Shared LiveEvent union: join/comment/like/follow/gift/share/audience; room audience events carry no viewer identity. Replaceable connector lifecycle/status. REST handles controls; sequenced WebSocket snapshots synchronize state and reconnecting clients.
- `!le`, `!nhang`, `!cau <prayer>` are free; `!sen` directs viewers to TikTok gifts without adding points. 10-second configurable viewer cooldown. Basic actions add 1 point. Prayers await approval before public display.
- Gift mappings set action, intensity, contribution. Unknown gifts receive modest generic offering. Deduplicate events and use streak count increases exactly once.
- Milestones at 100/250/500 illuminate and decorate; every further 500 triggers communal lotus ceremony. Store progress and reached milestones.
- Visitor state: enter → idle → kneel → bow/offer → idle → leave. Max 40 visible, depth sorted. Bounded effects and queues.
- Muted admin preview; independently adjustable ambient and ceremony audio. Mock mode by default; TikTok username/signing key in environment; credentials never shipped to browser.
- Persist settings, gift mappings, normalized events, approved/pending prayers, progress and per-session gratitude boards/audience milestones. Include backup instructions.

## Visual authority and skills
Reference supplied by user: `codex-clipboard-615967fb-dc77-4dce-86da-00d005633669.png`; copy to `docs/reference/temple-concept.png` before temporary attachment expires. Ornate golden altar, red carpets, warm lanterns, rows of kneeling visitors, lotus effects; painted 2.5D, independent layers, code-rendered Vietnamese text. No TikTok-native interactive buttons implied.

Source: https://github.com/gamedev-skills/awesome-gamedev-agent-skills . Select router, phaser-core, create-game-assets, game-ai, audio-design, performance-optimization. Pin fetched revision in skill provenance; read selectively per phase. Follow host imagegen workflow for raster generation and native-scale in-engine visual QA.

## Verification and scope
Unit/integration: command cooldown, streak deltas, duplicate events, milestones, moderation, database recovery, connector fixtures. Playwright: synchronized views, admin flows, reconnect, deterministic screenshots. Benchmark: 60 seconds, 40 visible visitors, gift bursts; record hardware/frame metrics. Production build and documented dev/start commands.

The user authorized rankings, narrator/TTS and audience milestones on 2026-10-31 as phases 7–9, in that order. Use Terra/Luna subagents for bounded work and Sol for complex integration. Deferred: themed rooms, daily activities, OBS automation, official TikTok partner integration, cloud hosting. Do not claim real TikTok reception or broadcasting until actually tested.
