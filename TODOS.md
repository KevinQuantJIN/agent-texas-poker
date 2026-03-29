# TODOS

## Smarter fallback bot when LLM circuit-breaks
**What:** Replace the random fold/call/raise fallback bot with a simple rule-based bot that plays tight-passive using basic hand strength evaluation.
**Why:** Random fallback bleeds chips and looks obviously dumb to spectators watching the stream. A bot that folds garbage and calls with decent hands looks intentional.
**Pros:** Better spectator experience, more realistic gameplay when an LLM provider goes down.
**Cons:** Requires a simple hand strength heuristic (~50 lines). Minor additional complexity.
**Context:** Circuit breaker activates after 3 consecutive LLM failures (timeout, API error, unparseable response). Current fallback is random-weighted fold/call/raise. Improvement: evaluate hole cards + community cards for basic hand strength (pair, two pair, etc.) and map to tight-passive actions.
**Depends on:** V1 circuit breaker implementation.
**Added:** 2026-03-29

## AI commentator (week 2 content)
**What:** A separate LLM subscribes to game events and provides color commentary in real time. "Claude has been playing tight all night, but that 3x raise on a garbage flop? This smells like a bluff."
**Why:** The cross-model review flagged this as the highest-impact V2 feature. Every hand produces a shareable commentary thread. This is the week 2 content banger for the Research Live series.
**Pros:** Massive content multiplier. Commentary screenshots are even more shareable than reasoning screenshots. Low implementation cost since the game engine already emits events.
**Cons:** Adds ~$0.05/hand in LLM costs. Needs a new UI component (commentary feed).
**Context:** Game engine emits events (handStart, agentThought, gameState, handEnd) that an observer can subscribe to. Wire up a commentator LLM that receives the event stream and produces running commentary. Display in a second sidebar or overlay.
**Depends on:** V1 event system.
**Added:** 2026-03-29

## Invalid API key error surfacing
**What:** Detect auth errors (401/403) specifically in the LLM adapter, log a server-side warning, and show a subtle "connection issue" indicator on the frontend for that player.
**Why:** If an API key is invalid or expired, the adapter retries once then folds. The spectator sees a named AI folding every hand with no explanation. For the hosted demo, this is confusing. For local dev, it wastes time debugging.
**Pros:** Better debugging experience, clearer spectator UX when a provider is down.
**Cons:** Minor additional complexity in adapter error handling + a small UI indicator component.
**Context:** Currently all API errors are treated the same (retry → fold → circuit breaker). Auth errors (401/403) should be distinguished because they won't resolve with retries. Server should log "WARNING: {provider} API key invalid or expired" and emit a player status event to the frontend.
**Depends on:** V1 LLM adapter.
**Added:** 2026-03-29

## Fix Gemini and Llama text contrast on dark backgrounds
**What:** Gemini (#4285F4, ~3.4:1) and Llama (#9C27B0, ~2.8:1) agent colors fail WCAG AA contrast (4.5:1 minimum) when used as text on dark backgrounds (#141a2a). Use lighter variants for text: Gemini → #5A9BF6 (~4.6:1), Llama → #B44FCC (~4.5:1). Keep original colors for avatar circle fills (white text on colored bg is fine).
**Why:** Low contrast text is hard to read, especially in screenshots that get compressed for social media. The reasoning sidebar and broadcast bar both render agent names in their color.
**Pros:** Accessible, more legible, screenshots look sharper.
**Cons:** Two agent colors now have a "fill" variant and a "text" variant. Minor complexity.
**Context:** CSS tokens defined in DESIGN.md. Implement by adding --agent-gemini-text and --agent-llama-text variants, or use a utility function that returns the text-safe color when rendering on dark backgrounds.
**Depends on:** CSS token system implementation.
**Added:** 2026-03-29 (design review)

## ReasoningSidebar: use player color from WebSocket data, not mock map
**What:** ReasoningSidebar.tsx imports agent colors from a hardcoded `AGENT_COLORS` map in mock-data.ts. Switch to using the `color` field from `AgentThought` (added in design review) which comes from the player's actual `PlayerState.color` via WebSocket.
**Why:** The mock-data color map will break when player IDs don't match the hardcoded keys, or when custom agents are added. Colors should flow from the server, not from a static map.
**Pros:** Colors always correct, supports future custom agents, removes a mock-data dependency from production code.
**Cons:** None. 5-minute change.
**Context:** Design review added `color: string` field to the `AgentThought` interface. The server populates it from `PlayerState.color` when constructing thoughts. The sidebar reads it from the thought data.
**Depends on:** V1 WebSocket server populating color in AgentThought.
**Added:** 2026-03-29 (design review)

## pokersolver replacement contingency
**What:** If the pokersolver 1000-hand smoke test fails or TypeScript integration is painful, replace with a custom hand evaluator (~200 lines).
**Why:** pokersolver is unmaintained (last publish ~2017/2020). No TypeScript types. May have edge case bugs in exotic hand rankings.
**Pros:** Custom evaluator gives full control, proper TS types, no unmaintained dependency.
**Cons:** ~200 lines to write and test. Hand evaluation is a solved problem so this is pure reimplementation.
**Context:** Trigger condition: run pokersolver against 1000 random 5-7 card hands, compare results against a reference implementation. If any disagreements, or if the lack of TS types creates friction, switch to custom. The custom evaluator maps each hand to a numeric rank (straight flush=9, four of a kind=8, ..., high card=0) with kicker comparison.
**Depends on:** Nothing. Can be done anytime.
**Added:** 2026-03-29

## Odd chip in split pot: clockwise from dealer
**What:** When a pot splits unevenly (e.g., $3 pot, 2 winners = $2 and $1), the extra chip should go to the winner closest to the dealer's left (clockwise). Currently `distributePot()` gives the remainder to the first player in the winner array, which is not sorted by seat position.
**Why:** Standard poker rule. Noticeable to poker-literate viewers in split pot scenarios.
**Pros:** Poker-correct behavior, edge case but adds authenticity.
**Cons:** Requires passing dealerIndex into distributePot and sorting winner IDs by seat position relative to the button. ~10 lines.
**Context:** `pot.ts:95` gives remainder to index 0. `game.ts:resolveHand` doesn't sort winners by seat position. The design doc comment says "caller should order by clockwise from dealer button" but the implementation doesn't.
**Depends on:** Nothing.
**Added:** 2026-03-30 (eng review)

## Default maxHands safety cap for cost control
**What:** Set a default `maxHands` cap (e.g., 200) to prevent runaway API costs in long games. Currently defaults to 0 (unlimited).
**Why:** With 6 LLMs at ~$0.15/hand, a degenerate game could run 500+ hands ($75+). A 200-hand cap costs ~$30 and still produces a full tournament.
**Pros:** Prevents runaway costs in edge cases.
**Cons:** Adds a default limit that might end games before a natural winner. Could be configurable via env var.
**Context:** `maxHands` config already exists in GameConfig (server/index.ts:258 passes `maxHands: 0`). Change to `maxHands: 200` or add `MAX_HANDS` env var.
**Depends on:** Nothing.
**Added:** 2026-03-30 (eng review)
