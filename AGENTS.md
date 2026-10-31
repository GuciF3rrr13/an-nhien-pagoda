# Chùa An Nhiên LIVE — agent instructions

Read `docs/STATUS.md` first, then the active phase in `docs/IMPLEMENTATION_PLAN.md`. Load only skills and source needed for that phase. Finish one phase and its acceptance checks before advancing. Update STATUS at every phase boundary and before ending a session, including failures and the next concrete action.

The local release is complete. Use README for startup/OBS/backup, `docs/SKILLS.md` for skill provenance, and `docs/qa/` for verification evidence. DESIGN.md and `.impeccable/design.json` capture the implemented visual system. Reuse an existing local server; do not reopen completed phases unless the user requests changes or a concrete regression is found.

## Fixed contract
- Local-first cooperative Vietnamese temple game; Phaser 4.2.1, React, TypeScript, Node.js 24, SQLite; npm workspace.
- `/game`, `/overlay`, `/admin`; 1080×1920 portrait game; 40 visible visitors; wide and altar camera presets.
- Preserve the approved golden Vietnamese temple reference: ornate altar, warm lanterns, red prayer carpets, kneeling congregation, painted layered 2.5D art.
- Backend owns progress and events. Mock and optional TikTok adapters share normalized events; REST controls and WebSocket state synchronization.
- Free commands `!le`, `!nhang`, `!cau <prayer>`; flowers require TikTok gifts (`!sen` is gift guidance); default 10-second viewer cooldown; offering milestones 100, 250, 500, then every additional 500.
- Public prayers require operator approval. Gift streak increments count once. SQLite stores settings, mappings, events, prayers, and progress.
- Bind locally; credentials belong in ignored environment files. Never expose signing credentials to browsers or logs.
- Authorized extension (phases 7–9): per-LIVE Bảng tri ân, Vietnamese narrator/thanks, simultaneous-viewer milestones and sharing. Use Terra/Luna subagents for bounded work and Sol for complex integration. Deferred: themed rooms, daily activities, OBS WebSocket automation, official partner integration, cloud deployment.

## Quality and context budget
- Preserve established interfaces and approved artwork. Record significant decisions instead of reopening them every session.
- Read relevant GameDev skills before their tasks; use a pinned project-local selection, not the full catalog.
- Inspect generated art at native scale and in engine; prompts alone do not establish production quality.
- Test meaningful behavior in its owning phase. Repeat passing checks only after relevant changes; broad regression belongs to release validation.
- Use deterministic mock events for visual tests. Test synchronization, reconnects, cooldowns, gift streaks, deduplication, persistence, moderation, and 40-visitor performance.
- Never claim a check that was not run. Real TikTok input and broadcasting stay unverified until exercised against an available LIVE session.
- Keep handoffs short: phase, changed contracts, checks/results, blockers, next action. Do not add features outside the agreed release.
