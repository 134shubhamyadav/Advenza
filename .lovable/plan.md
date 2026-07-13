# Aventra AI Companion, build plan

This is a large scope (10 feature areas). To keep it shippable and cohesive, I'll build all 10 as a connected experience on top of a shared mock "AI engine" (deterministic TS module, no backend). Everything stays frontend / presentation, matching the current mock-data pattern. No Lovable Cloud yet.

## Shared foundation
- `src/lib/ai-engine.ts`: typed mock intelligence, single source of truth
  - traveler profiles (interests, budget, walking tolerance, luxury, adventure, food)
  - trip state (destination, dates, budget, itinerary refs)
  - derived: compatibility %, satisfaction %, health score + factor breakdown
  - event log (delays, weather, cancellations) with `explain()` reasoning
  - `simulate(change)` returns projected diff without mutating state
- `src/lib/ai-copy.ts`: reasoning/explanation string builders (pros, cons, why, cost/time impact)
- Design tokens: add `--score-good / --score-warn / --score-bad`, subtle "AI" accent chip style in `src/styles.css`
- Reusable UI primitives in `src/components/ai/`:
  - `AiBadge`, `ScoreRing`, `FactorBar`, `ReasoningPopover`, `DiffPill`, `TimelineEvent`, `RiskChip`, `TradeoffMatrix`

## New routes (each = one feature area)
1. `/commander` — AI Trip Commander: live event feed, auto re-plan cards ("Flight 6E 5311 delayed 2h, moved City Palace to Day 2, saved ₹1,800"), accept/undo
2. `/consensus` — Decision Engine: traveler preference radar per person, group compatibility %, final itinerary with per-item "compromise" notes
3. `/health` — Trip Health Score: big ring (93/100) + 7 factor bars, each expandable with suggestions
4. `/simulator` — What-If Simulator: sliders/toggles (budget ±, dates, +/- traveler, hotel tier, transport), animated diff panel
5. `/risk` — AI Risk Radar: category tiles (weather/scams/crowd/night/transport/closures), risk level chips, prevention tips, SOS contacts
6. `/memory` — Memory Timeline: day cards with photos, spend, weather, AI-written highlight blurb
7. `/packing` — Smart Packing Assistant: grouped checklist (essentials/weather/docs/electronics/meds), reasoning per item
8. Trip Twin activity feed: embedded on `/commander` + a compact widget on `/dashboard`

## Enhancements to existing routes
- `/itinerary`: add "Why this?" popover on each activity (AI explainability), tradeoff toggle for hotel/transport cards
- `/dashboard`: add Health Score ring + latest Twin activity + Risk chip
- `/trips/santorini`: tradeoff engine on hotel/flight/activity cards (price/time/comfort/rating/confidence, pros/cons, "best for" tags)
- `AppShell` sidebar: add nav entries for Commander, Health, Simulator, Risk, Memory, Packing

## Explainability pattern (used everywhere)
Every AI recommendation card renders:
- Match % chip
- Collapsible reasoning: Why · Pros · Cons · Cost impact · Time impact · Distance
Never a bare suggestion.

## UX rules I'll follow
- Calm density, generous whitespace, one hero moment per screen
- Framer-motion for score ring fill, diff animations, timeline reveals (subtle, ≤400ms)
- Semantic tokens only, no hardcoded colors
- INR everywhere (already standardized)
- Mobile: stack, keep score rings, collapse factor bars

## Out of scope (call out)
- No real backend/LLM calls, no Lovable Cloud, no auth changes
- No push notifications (group "notify" is a UI toast)
- Memory Timeline uses existing Unsplash imagery, no upload flow

## Rough file impact
- New: ~7 route files, `ai-engine.ts`, `ai-copy.ts`, ~7 components under `src/components/ai/`
- Edited: `app-shell.tsx`, `itinerary.tsx`, `dashboard.tsx`, `trips.santorini.tsx`, `styles.css`

Confirm and I'll build straight through. If you'd rather I ship a subset first (say Commander + Health + Simulator + Explainability as the "wow" core), tell me which and I'll trim.