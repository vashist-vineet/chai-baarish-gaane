# CBG — Mobile Performance Optimization: JavaScript Startup Investigation & Implementation Plan

**Project:** Chai Baarish Gaane (CBG)
**Target:** Mobile Cold-Load Startup, Parser Blocking & Main-Thread Total Blocking Time (TBT)
**Reference Report:** [`docs/performance/cbg-live-lighthouse-performance-report.md`](file:///Users/luckyali/Desktop/Veranda/chai-baarish-gaane/docs/performance/cbg-live-lighthouse-performance-report.md)
**Hero Optimization Plan:** [`docs/performance/cbg-hero-image-optimization-plan.md`](file:///Users/luckyali/Desktop/Veranda/chai-baarish-gaane/docs/performance/cbg-hero-image-optimization-plan.md)
**Mode:** Read-Only Investigation & Implementation Plan (Zero Code Modifications)
**Branch:** `dev` (HEAD: `1ae708f`)
**Date:** 2026-10-28

---

## 1. Findings & Startup Bottleneck Evidence

### 1.1 Context & Problem Statement
The hero image WebP optimization resolved the primary mobile wire-transfer bottleneck (reducing hero transfer from 350.4 KB to 33.7 KB). However, the baseline Lighthouse performance audit established that **mobile cold-load scores fluctuated between 57 and 90** (with a median of 80 and a user-observed manual test of 62).

This volatility is driven entirely by **Total Blocking Time (TBT)** during cold start, which swings between **130 ms and 1,860 ms** under simulated 4× mobile CPU throttling.

### 1.2 Measured Main-Thread Breakdown on Cold Boot
Inspection of Chrome performance trace logs from the baseline cold mobile audits (`mobile_cold_2` and `mobile_run1`) reveals:

| Main-Thread Activity | Cold Duration under 4× CPU Throttling | Root Contributors |
|---|:---:|---|
| **Style & Layout** | **1,502 ms – 1,887 ms** | Massive 4,904-line stylesheet (`style.css`), complex multi-layer pseudo-elements, multiple canvas resizes, and boot-time DOM property writes |
| **Script Evaluation** | **582 ms – 941 ms** | Parser-blocking execution of `playlist.js` (188.8 KB), `hindi-playback-eligibility.js`, and `script.js` boot loops |
| **Parse HTML & CSS** | **244 ms – 355 ms** | Parsing inline HTML interrupted by synchronous classic scripts |
| **Rendering** | **226 ms – 355 ms** | Compositing initial background curtains, canvas buffers, and text locks |

### 1.3 Identified Startup Bottlenecks

#### Bottleneck 1: Parser-Blocking Classic Scripts in `<head>` and `<body>`
In `index.html` (lines 486–491):
```html
<script src="playlist.js?v=hindi-catalog-20261016-5"></script>
<script src="hindi-playback-eligibility.js?v=verified-hindi-20261028-1"></script>
<script src="share-context.js?v=verified-hindi-20261016-1"></script>
<script src="script.js?v=playlist-lazy-render-20261019-1" defer></script>
```
- **Evidence:** `playlist.js` (188.8 KB uncompressed, 53.8 KB transfer), `hindi-playback-eligibility.js` (5.8 KB), and `share-context.js` (4.4 KB) lack the `defer` attribute.
- **Impact:** Although placed near the end of `<body>`, the HTML parser pauses synchronous document completion while downloading and executing `playlist.js` (which instantiates 1,365 song objects in memory). Lighthouse traces attribute long tasks of **668 ms** and **285 ms** directly to document-level parsing because of these inline synchronous evaluations.

#### Bottleneck 2: Eager Filter Count Computation on Hidden Drawer
In `script.js` (lines 2007–2018 and line 3479):
```javascript
function updateFilterOptionCounts() {
  Array.from(els.languageFilters?.options || []).forEach((option) => {
    option.dataset.label ||= option.textContent.trim();
    const count = countEligibleTracks(option.value, state.selectedMood);
    option.textContent = `${option.dataset.label} (${count})`;
  });
  Array.from(els.moodFilters?.options || []).forEach((option) => {
    option.dataset.label ||= option.textContent.trim();
    const count = countEligibleTracks(state.selectedLanguage, option.value);
    option.textContent = `${option.dataset.label} (${count})`;
  });
}
```
- **Evidence:** During synchronous boot (`initialize()`), `updatePlaylistSummary()` immediately calls `updateFilterOptionCounts()`. There are 16 language options and 14 mood options (30 options total). For each option, it iterates over all 1,365 songs in `playlist` to calculate eligibility counts:
  $$\text{Total iterations} = 30 \times 1,365 = \mathbf{40,950\text{ track evaluations}}$$
- **Impact:** It then performs 30 DOM mutations on `<option>` labels inside `<select id="languageFilters">` and `<select id="moodFilters">`. Both selects are located inside `#playlistDrawer`, which is **closed and hidden** on initial page load. The user is on the entrance curtain ("andar aao") and has not even entered the room, yet the main thread executes 40,950 array iterations and 30 DOM writes on hidden dropdowns.

#### Bottleneck 3: Eager Instantiation of 5 Inactive Environment Particle Systems
In `script.js` (lines 1733–1739):
```javascript
const rain = new RainCanvas(els.canvas, () => environmentEffectIsActive("monsoon"));
const entryRain = new RainCanvas(els.entryCanvas, () => !document.body.classList.contains("entry-settled"));
const snow = new SnowCanvas(els.snowCanvas);
const petals = new PetalCanvas(els.petalCanvas);
const butterflies = new ButterflySystem(els.butterfliesContainer);
const leaves = new LeafCanvas(els.leafCanvas);
const dust = new SandCanvas(els.sandCanvas);
```
- **Evidence:** On cold boot, CBG is always in the **Monsoon** environment on the **Landing Curtain**. Only `entryRain` is active.
- **Impact:** The constructors for `SnowCanvas` (winter), `PetalCanvas` (spring), `ButterflySystem` (spring), `LeafCanvas` (autumn), and `SandCanvas` (desert) all execute synchronously during script load. Each calls `this.resize()`, query 2D canvas contexts, bind resize event listeners, and allocate hundreds of particle objects in memory for environments the user may never switch into during that session.

#### Bottleneck 4: Redundant UI Invocations in Startup Sequence
In `script.js` (lines 3473–3480):
- Line 3473 calls `applyEnvironmentUi(state.environment)`, which calls `updateTrackUI({ preserveProgress: true })` (line 1939).
- Inside `applyEnvironmentUi`, lines 1941–1945 invoke `.setMode()` on `snow`, `petals`, `leaves`, `dust`, and `coastVideo`, even though the environment is `monsoon`.
- Then, line 3480 in `initialize()` calls `updateTrackUI()` a second time.
- **Impact:** Triggers duplicate DOM queries, textContent assignments, and progress bar resets on initial paint.

---

## 2. Behavioral Protections & Architectural Invariants

Any planned JavaScript optimizations must strictly protect the following core invariants:

1. **Playlist Integrity & Eligibility:**
   - All 1,365 songs across 16 language catalogs must remain intact.
   - The verified Hindi manifest (197 eligible tracks, 5 exclusions, verified hashes) must remain completely untouched.
   - No catalog reduction, song removal, or truncation is permitted.
2. **Deterministic Playback & Lazy Rendering:**
   - Song selection, queue navigation (Next / Previous / Shuffle), language/mood filtering, and deep-link context restoration must work identically.
   - The lazy playlist rendering architecture (`state.playlistRendered`, deferred until drawer opens) must be respected.
   - YouTube iframe player initialization must remain user-intent gated (never initialized before clicking "ENTER").
3. **Execution Order Guarantee:**
   - `playlist.js` must evaluate before `hindi-playback-eligibility.js`.
   - `hindi-playback-eligibility.js` must evaluate before `share-context.js`.
   - `share-context.js` must evaluate before `script.js`.

---

## 3. Ranked Optimization Candidates

### Candidate 1: Add `defer` to All Script Tags in `index.html` [HIGH PRIORITY]
- **Problem:** `playlist.js`, `hindi-playback-eligibility.js`, and `share-context.js` lack `defer`. The HTML parser pauses during initial document construction to synchronously execute 188 KB of object definitions.
- **Proposed Change:** In `index.html` (lines 486–488):
  ```html
  <script src="playlist.js?v=hindi-catalog-20261016-5" defer></script>
  <script src="hindi-playback-eligibility.js?v=verified-hindi-20261028-1" defer></script>
  <script src="share-context.js?v=verified-hindi-20261016-1" defer></script>
  <script src="script.js?v=playlist-lazy-render-20261019-1" defer></script>
  ```
- **Technical Invariant:** According to the HTML5 specification (Section 4.12.1), all deferred scripts download in parallel during HTML parsing and **execute in exact document order** immediately after document parsing completes, before `DOMContentLoaded`.
- **Expected Benefits:**
  - Unblocks the HTML parser, eliminating the 668ms / 285ms inline document long tasks.
  - Zero risk of race conditions because browser-guaranteed source order preserves `window.CBG_PLAYLIST` $\rightarrow$ `window.CBG_PLAYBACK_ELIGIBILITY` $\rightarrow$ `window.CBG_SHARE_CONTEXT` $\rightarrow$ `script.js`.
- **Required Regression Tests:**
  - Verify `window.CBG_PLAYLIST` exists when `script.js` runs.
  - Run `test/*playback*.test.js` and `test/hindi-playback-eligibility.test.js`.

---

### Candidate 2: Defer Drawer Filter Option Counts until Drawer Opens [HIGH PRIORITY]
- **Problem:** `updateFilterOptionCounts()` executes 40,950 array iterations and 30 DOM `<option>` updates on hidden `<select>` dropdowns inside `#playlistDrawer` during cold initial page load.
- **Proposed Change:** Guard `updateFilterOptionCounts()` with the existing `isPlaylistOpen()` helper, running it only when the drawer opens:
  ```javascript
  function updateFilterOptionCounts() {
    if (!isPlaylistOpen()) return;
    Array.from(els.languageFilters?.options || []).forEach((option) => { ... });
    Array.from(els.moodFilters?.options || []).forEach((option) => { ... });
  }
  ```
  In `openPlaylist()`, call `updateFilterOptionCounts()` alongside `renderPlaylist()`.
- **Expected Benefits:**
  - Eliminates 40,950 loop iterations and 30 DOM updates from the critical startup path.
  - Aligns filter dropdown counting with the existing lazy playlist track rendering strategy.
  - Directly reduces startup CPU execution by ~15–30 ms on throttled mobile devices.
- **Required Regression Tests:**
  - Open playlist drawer and verify all language option counts `(197)`, `(100)`, etc., populate accurately.
  - Run `test/playlist-lazy-render.test.js`.

---

### Candidate 3: Lazy Instantiation of Inactive Environment Canvases [MEDIUM PRIORITY]
- **Problem:** Script evaluation eagerly constructs `SnowCanvas`, `PetalCanvas`, `ButterflySystem`, `LeafCanvas`, and `SandCanvas` on cold boot, allocating particle buffers and measuring canvas sizes for 5 inactive seasons.
- **Proposed Change:**
  - Instantiate only `entryRain` and `rain` on boot (for monsoon).
  - Convert `snow`, `petals`, `butterflies`, `leaves`, and `dust` into lazily instantiated controllers created on first switch into that season:
    ```javascript
    function getEnvironmentEffect(env) {
      if (env === "winter") return (snow ||= new SnowCanvas(els.snowCanvas));
      if (env === "spring") return (petals ||= new PetalCanvas(els.petalCanvas));
      ...
    }
    ```
- **Expected Benefits:**
  - Eliminates 5 canvas 2D context queries and hundreds of particle object allocations during cold boot.
  - Saves ~20–40 ms of startup scripting and garbage collection pressure.
- **Potential Risk:** Switching environments for the first time might incur a ~5ms instantiation delay. Handled by warming the target environment during the 3-second transition fade.
- **Required Regression Tests:**
  - Run `test/environment-effects.test.js` to confirm all effect loop lifecycle invariants hold.
  - Verify switching between all 6 environments remains visually smooth.

---

### Candidate 4: Clean Up Redundant Startup Invocations [MEDIUM PRIORITY]
- **Problem:** `initialize()` calls `applyEnvironmentUi()`, which calls `updateTrackUI({ preserveProgress: true })` and `.setMode()` on all inactive environments. Then `initialize()` calls `updateTrackUI()` again 7 lines later.
- **Proposed Change:**
  - Remove the duplicate `updateTrackUI()` call at line 3480.
  - In `applyEnvironmentUi()`, call `.setMode()` only on the active environment controller rather than all 5 inactive controllers.
- **Expected Benefits:** Eliminates duplicate DOM writes to track title, artist, progress bar, and active list queries on boot.
- **Required Regression Tests:** Verify initial track title, artist, and mood badge display correctly on landing screen and radio console.

---

### Candidate 5: Asset Minification via Lightweight Build Step [LOW PRIORITY]
- **Problem:** `playlist.js` (188.8 KB), `script.js` (142.5 KB), and `style.css` (149.4 KB) are served unminified.
- **Analysis:**
  - Lighthouse estimates ~13 KiB compressed transfer savings across all assets.
  - Transfer savings are modest compared to the 316 KB saved by WebP images.
  - However, minifying removes whitespace and comments, reducing V8 AST parsing and compilation overhead by ~10–15% under CPU throttling.
  - *Drawback:* CBG is currently a zero-dependency project without a build pipeline. Introducing a complex bundler (Webpack/Vite) would increase maintenance complexity.
- **Recommendation:** Low priority. If desired, use a simple `npm run build` script with `esbuild` or `terser` to emit `.min.js` and `.min.css` assets without changing source structure.

---

## 4. Recommended Implementation Order

To maintain strict stability and isolate performance gains, execute in this order:

| Step | Action | Focus | Dependency / Risk |
|:---:|---|---|---|
| **Phase 1** | Add `defer` to `playlist.js`, `hindi-playback-eligibility.js`, and `share-context.js` in `index.html` | Parser unblocking | Zero risk (HTML5 preserves execution order) |
| **Phase 2** | Defer `updateFilterOptionCounts()` until drawer opening in `script.js` | Main-thread CPU reduction | Very low risk (tested via `playlist-lazy-render.test.js`) |
| **Phase 3** | Eliminate redundant `updateTrackUI` and mode calls during `initialize()` | Main-thread deduplication | Very low risk |
| **Phase 4** | Lazily instantiate inactive environment canvases on first environment switch | Memory & context reduction | Low risk (verified via `environment-effects.test.js`) |
| **Phase 5** | Evaluate minification only if TBT remains above 200 ms | AST parsing optimization | Tooling complexity |

---

## 5. Fair Before / After Validation Procedure

### 5.1 Protocol Standards
1. **Throttling Profile:** Google Chrome 156 (Headless), Lighthouse 11.7.1, Moto G4 emulation (412×823, DPR 1.75), Simulated 4G (1638.4 Kbps, 150ms RTT, 4× CPU slowdown).
2. **Cold Cache Execution:** Always test with storage reset enabled to capture the true worst-case visitor experience.
3. **Multi-Run Median:** Execute **3 consecutive cold mobile audits** and report the median, alongside 1 desktop audit.

### 5.2 Success & Stop Criteria

Further JavaScript optimization is **no longer worthwhile** when:
1. **Total Blocking Time (TBT):** Consistently stays below **200 ms** across cold mobile runs ($\le 200\text{ ms}$ is the Google Core Web Vitals "Good" threshold).
2. **Mobile Performance Score:** Reaches and stabilizes at **90+** across cold runs.
3. **Largest Contentful Paint (LCP):** Remains $\le 2.0\text{ s}$ on mobile and $\le 0.6\text{ s}$ on desktop.
4. **Behavioral Invariants:** All 80 test suite tests pass, catalog remains 100% intact, and visual aesthetics are completely preserved.

---
*End of Investigation Plan. Awaiting user authorization before modifying any project files.*
