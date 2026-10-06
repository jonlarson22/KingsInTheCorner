# Kings in the Corner — Dev Log & AI Handoff

> Purpose: so any AI picking up this repo knows what the app does, what's been
> done, and what to watch out for. Updated 2026-10-02. This file is
> documentation only — it is intentionally NOT in the service worker cache.

## 1. What this is

A Kings in the Corner card game as a PWA. Vanilla HTML/CSS/JS, no frameworks,
no build step. Single human can play against bots, or multiple humans can
pass-and-play on one device.

- Repo: `jonlarson22/KingsInTheCorner`, branch `main`
- Served as static files (index.html + assets)

## 2. File map

| File | Lines | Role |
|---|---|---|
| `index.html` | 135 | All screens: setup, hold ("pass the device"), win, game board, hand, drag ghost |
| `app.js` | ~1016 | All game logic: state, rendering, drag & drop, bot, undo, save/load, sounds |
| `style.css` | ~673 | Layout + 10 table themes via CSS variables on `body[data-theme]` |
| `sw.js` | 65 | Cache-first service worker, `CACHE_NAME = 'kings-corner-v4.2'` |
| `manifest.json` | 21 | PWA manifest (name, 192+512 icons, portrait) |
| `sounds/` | — | 6 valid MP3s: draw, drop-valid, drop-invalid, turn-notify, win-round, win-tournament |
| `images/` | — | icon-192.png, icon-512.png (verified correct dimensions) |

## 3. How the app functions

**Setup screen** (`setupGameScreen`): player count (2–4), per-player icon
(from a fixed emoji list), name, Human/Bot toggle (player 1 defaults human,
others default bots), game mode (casual / tournament with point limit
50/100/150/200), table theme select, undo toggle.

**Round init** (`initGame`): builds a 52-card deck (`createDeck`), Fisher–Yates
`shuffle`, deals 7 cards to each player, seeds the four side piles
(north/east/south/west) with one card each. Corners (nw/ne/se/sw) start empty.

**Turn flow:**
1. `showHoldScreen` — "pass the device" interstitial. Skipped when only one
   human plays (goes straight in) or when the next player is a bot.
2. `startPlayerTurnUI` — enables the deck if the player must draw.
3. Human **must draw first** (deck click, animated card flight via
   `.card-flying` ghost) unless the deck is empty. Dragging before drawing
   plays the invalid sound + shakes the deck.
4. **Drag & drop** (pointer events): cards from the hand, or whole piles
   (validated on the pile's *bottom* card). `highlightValidMoves` greens
   valid targets during drag. `pointercancel` is handled (interrupted drags
   clean up).
5. `End Turn` advances the index, clears undo history, saves, shows hold screen.

**Move rules** (`isValidMove(card, targetPile, isCorner)` — single source of
truth used by human drops, highlights, and the bot):
- Empty corner pile: only Kings.
- Empty side pile: any card.
- Non-empty pile: descending rank by exactly 1, alternating red/black
  (e.g. red 9 on black 10). Kings can never build on anything.

**Bot** (`checkAITurn` → `executeAIMoves`, one move per ~1.6s tick): draws,
then moves whole piles and plays hand cards. Deliberately restricted by
`canBotMovePile` to (a) building onto non-empty piles and (b) moving a
K-led side pile to an empty corner. It is NOT allowed to shuttle piles
between open side spots — that caused an infinite back-and-forth loop
(see history). Hand cards may still be played to any legal spot.

**Winning** (`executeMove` → `showWinScreen`): emptying your hand ends the
round. Hand penalty: K/Q/J = 10, A = 1, others face value
(`calculateHandScore`). Tournament mode: lowest total score wins once someone
reaches the point limit.

**Undo:** `saveSnapshot()` before every human move (never for bot moves),
capped at 15 entries; history is cleared on turn end and on new round, so
undo only ever unwinds the current human turn.

**Persistence:** `saveGame()` writes full state (minus history) to
`localStorage` key `kingsCornerSave` after every move/draw/turn. On load,
`loadGame()` offers resume via `confirm()`. Theme choice persists under
`kingsCornerTheme`. Quit button clears the save.

**Sounds:** `SoundManager` uses WebAudio; `init()` is wrapped in try/catch so
browsers without WebAudio don't kill page setup. `play()` is a no-op until
a buffer loads.

**PWA/service worker:** install caches every asset *independently* with
`cache.add(new Request(url, { cache: 'reload' }))` — the reload bypass
prevents a stale HTTP-cached copy from poisoning the versioned cache, and
per-asset catch means one failure (e.g. the cross-origin confetti CDN)
can't fail the whole install. `skipWaiting()` + `clients.claim()` on
activate. Fetch handler is cache-first with network fallback.
**IMPORTANT: bump `CACHE_NAME` on every change to any cached asset
(index.html, style.css, app.js, sounds, images), or installed users will
never receive the update.**

**Themes:** `setupThemeSwitcher()` sets `body[data-theme]` from the select;
all theme styling flows through CSS variables. Every theme defines
`--table-bg`, `--table-pattern`, `--card-stripe-1/2`, `--card-accent`,
`--page-bg`. Light themes additionally override `--ink`, `--pile-bg`,
`--pile-border`, `--pile-corner-bg`, `--deck-bg`, `--deck-border`,
`--bar-bg`, `--bar-border`, `--deck-count-color` (dark themes inherit the
dark defaults from `:root`). Modal text is pinned white since modals are
always dark green. Current 10 themes, alphabetical by visible label:
Classic Green Felt, Crimson Royale, Desert Mirage, Ember Night, Glacier,
Midnight Slate, Parchment, Royal Velvet, Sleek Brushed Steel, Warm Oak Wood.

**Security notes:** player names are HTML-escaped (`escapeHtml`) before
`innerHTML` insertion; `showWinScreen` takes the player object (not a name
lookup, so duplicate names are safe).

## 4. Session history (2026-10-02)

1. **Audit** — cloned the repo, read every file, validated `app.js` by real
   import (not `--check`), and ran 19 unit tests: 52-card deck integrity,
   shuffle preservation, move-validation matrix, canon scoring — all
   correct. Found ~13 issues (below).
2. `dce1412` — Audit fixes, SW → v3.3: fixed draw-card fly animation
   (`.card-flying` transition was dropping `left`/`top`); unified
   `isValidMove(card, pile, isCorner)` across drops/highlights/AI;
   fixed `activeDrag` leak on same-pile drop; added `pointercancel`
   cleanup; corner "K" hint label now rebuilt every render; AudioContext
   crash guard; per-asset SW install caching; player-name escaping;
   win screen takes player object; undo scoped to current human turn;
   draw-animation race guard; removed dead CSS + duplicate icon.
3. `ff124b7` — Restored **midnight-slate** as a complete standalone theme
   (its menu option had been removed in July and its CSS folded into
   brushed-steel; it also never defined card-back vars). Dark slate table
   + teal card backs. SW → v3.4.
4. `c62b824` — Fixed bot infinite loop: the bot moved piles to empty side
   spots and back forever (reverse move always legal). Added
   `canBotMovePile`; bot pile moves limited to real builds + K-led side
   pile → empty corner. SW → v3.5.
5. `d0bf875` — Root-caused "midnight-slate shows default green": SW
   install wasn't bypassing the browser HTTP cache, so a stale stylesheet
   poisoned the versioned app cache. Install now uses
   `Request(url, { cache: 'reload' })`. SW → v3.6. User confirmed working
   after hard refresh.
6. `cfdf37b` — Added 4 dark themes (crimson-royale, desert-mirage,
   ember-night, royal-velvet). SW intentionally left at v3.6 (batching).
7. `33a4cb8` — Added **Glacier** (ice-blue/navy) and **Parchment**
   (cream/forest) light themes + the themeable chrome variables described
   above; alphabetized the theme menu. SW → v4.0.
8. `ad23d28` — Dark themes were falling back to the default green page
   backdrop; each now defines its own `--page-bg` (darker shade of its
   table). SW → v4.1.
9. `b2b590b` — Menu had been sorted by internal value, not visible label;
   re-sorted by label. SW → v4.2.

## 5. Conventions for future work

- Work has been done **directly on `main`**, committed and pushed per the
  user's explicit instruction each time. Keep following his lead on
  branching vs. main; don't assume.
- **Always bump `CACHE_NAME` in `sw.js`** when changing cached assets.
  Version history: v3.2 → v3.3 → v3.4 → v3.5 → v3.6 → v4.0 → v4.1 → v4.2
  (all on 2026-10-02).
- Git identity used for commits: `Jonathan <40722881+jonlarson22@users.noreply.github.com>`
  (set repo-local; the VM has no global git identity).
- Vanilla JS only, no frameworks — matches the user's stated preference
  on his other projects.
- Validate JS by actually importing/evaluating it
  (`node --input-type=module -e "import('...')"`), never by `--check`
  alone — `--check` once passed a file with a genuine SyntaxError here.
- Logic functions (`createDeck`, `shuffle`, `isValidMove`,
  `calculateHandScore`, `canBotMovePile`, `escapeHtml`) are pure and
  unit-testable via `node:vm` with stubbed browser globals.

## 6. Known gaps / intentionally deferred

- No keyboard alternative to drag-and-drop; cards are `<div>`s with no
  ARIA roles; `user-scalable=no` is set. (Accessibility — deferred.)
- `confirm()` dialog on page load when a save exists (works as designed).
- A live browser smoke test wasn't possible (test browser runs on a
  separate VM from the local static server); verification was static +
  unit tests + user screenshots.
