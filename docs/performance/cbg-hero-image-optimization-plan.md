# CBG — Mobile Performance Optimization: Hero Image Investigation & Implementation Plan

**Project:** Chai Baarish Gaane (CBG)
**Target:** Initial Mobile Page Load & Hero Image Optimization
**Reference Report:** [`docs/performance/cbg-live-lighthouse-performance-report.md`](file:///Users/luckyali/Desktop/Veranda/chai-baarish-gaane/docs/performance/cbg-live-lighthouse-performance-report.md)
**Mode:** Read-Only Investigation & Implementation Plan (Zero Code Modifications)
**Branch:** `dev` (HEAD: `1ae708f`)
**Date:** 2026-10-28

---

## 1. Current Implementation & Baseline Findings

### 1.1 Hero Image Specifications
- **Source Asset:** [`assets/images/veranda-monsoon.jpg`](file:///Users/luckyali/Desktop/Veranda/chai-baarish-gaane/assets/images/veranda-monsoon.jpg)
- **Pixel Dimensions:** **1672 × 941 px** (approx. 16:9 aspect ratio)
- **File Format:** JPEG (Baseline, sRGB IEC61966-2.1, 8-bit RGB, no alpha)
- **File Size on Disk:** **350,045 bytes** (~341.8 KB / 342 KB)
- **Network Transfer Size:** **350,418 bytes** (HTTP/2 with headers)
- **Proportion of Page Weight:** **71.4%** of initial mobile load (~350 KB out of ~480 KB total transfer)

### 1.2 References in Codebase
The hero image is **not** an HTML `<img>` tag. It operates through CSS custom properties and preloading:

1. **HTML Preload (`index.html`, Line 24):**
   ```html
   <link rel="preload" href="assets/images/veranda-monsoon.jpg" as="image" type="image/jpeg" fetchpriority="low" />
   ```
   *Analysis:* The image is preloaded, but `fetchpriority="low"` is assigned. Because this image constitutes the primary visual backdrop of the entrance curtain, Chrome's network scheduler deprioritizes it behind JavaScript bundles and stylesheets, artificially delaying the Largest Contentful Paint (LCP).

2. **CSS Custom Property (`style.css`, Lines 78 & 1256):**
   ```css
   /* Active radio scene background (Line 78) */
   .scene-image {
     --scene-art: url("assets/images/veranda-monsoon.jpg");
   }

   /* Landing entrance curtain backdrop (Line 1256) */
   .entry-backdrop {
     --scene-art: url("assets/images/veranda-monsoon.jpg");
   }
   ```

3. **CSS Composited Rendering (`style.css`, Lines 102–138):**
   Both `.entry-backdrop` and `.scene-image` render using dual pseudo-elements:
   - `::before`: Rendered with `background-size: cover; filter: blur(22px) brightness(.68) saturate(.76); inset: -3%;` to create soft edge-bleeding on non-16:9 screens.
   - `::after`: Rendered with `background-size: var(--scene-fit, contain); inset: 0;` to render the sharp, un-cropped veranda composition.
   - Both layers point to `background-image: var(--scene-art)`.

### 1.3 Baseline Performance Evidence (Live Website)
- **Desktop Performance:** **100 / 100** (repeatable across runs; LCP = 0.6s, TBT = 10ms, CLS = 0.000).
- **Mobile Performance (Cold Runs):** **57 to 90** (median = **80**, user observed **62**).
- **Mobile LCP:** **2.5 s to 3.1 s** (consistently above the Google "Good" threshold of $\le 2.5\text{ s}$).
- **Root Cause of High Mobile LCP:** On simulated 1.6 Mbps mobile bandwidth, downloading a single 350 KB JPEG requires ~1.75 seconds of pure wire time. Combined with SSL/TCP negotiation and initial stylesheet discovery, mobile LCP cannot drop below 2.5 seconds with the current image weight.

---

## 2. Recommended Image Format & Responsive Strategy

### 2.1 Format Evaluation: WebP vs. AVIF

| Evaluation Metric | WebP (Recommended Primary) | AVIF (Alternative / Secondary) |
|---|---|---|
| **Global Browser Support** | **> 97.4%** (Universal: Chrome, Safari iOS 14+, Firefox, Edge) | **~ 93.8%** (Chrome 85+, Firefox 93+, Safari 16.4+) |
| **Local Tooling** | `cwebp` 1.6.0 installed natively at `/opt/homebrew/bin/cwebp` | `ffmpeg` with `libsvtav1` available; `avifenc` not found |
| **Measured Size (Full Res, 1672×941)** | **86.8 KB** (Q80) / **113.1 KB** (Q85) | **75.1 KB** (CRF 30) |
| **Transfer Savings vs. JPEG** | **~ 237 KB to 263 KB saved (68%–75% reduction)** | **~ 275 KB saved (78% reduction)** |
| **Encoding Speed & Reproducibility** | Fast (< 200ms per file, deterministic) | Slower (~ 1.5s per frame) |
| **Visual Quality (PSNR)** | **43.9 dB to 45.3 dB** (visually lossless) | High, but subtle edge-smoothing on dark textures |
| **Recommendation** | **Adopt WebP as the production standard** | Optional future enhancement via `<picture>` |

*Decision:* **WebP** is the superior practical choice for Chai Baarish Gaane because:
1. It is supported by 100% of modern iOS and Android browsers without fallback risk.
2. The official Google encoder (`cwebp` 1.6.0 with `libsharpyuv`) is already present on the system.
3. It achieves a 75% file size reduction without any noticeable color banding or rain droplet blur.

### 2.2 Dual-Variant Responsive Strategy

Mobile devices have viewports of 360–430px (e.g. 412px on Moto G4 / Pixel). Even with a 2× or 3× device pixel ratio, serving a 1672px wide image to a phone wastes cellular bandwidth and GPU texture memory.

A dual-variant strategy is recommended:

| Variant | Target Viewport | Target Dimensions | Quality Setting | Measured File Size | Savings vs. Current JPEG |
|---|---|---|:---:|:---:|:---:|
| **Mobile (`veranda-monsoon-mobile.webp`)** | Max width $\le 768\text{ px}$ | **836 × 470 px** (50% scale) | Q80–Q82 | **29.1 KB** | **321 KB saved (91.6% reduction)** |
| **Desktop (`veranda-monsoon.webp`)** | Min width $> 768\text{ px}$ | **1672 × 941 px** (100% scale) | Q82–Q85 | **86.8 KB – 113.1 KB** | **237 KB – 263 KB saved (71.5% reduction)** |
| **Legacy Fallback (`veranda-monsoon.jpg`)** | Preserved for legacy clients | 1672 × 941 px | Current | 350.0 KB | 0 KB (baseline) |

### 2.3 CSS Implementation Architecture

Because the image is rendered via CSS custom properties on pseudo-elements, update `style.css` using a clean media-query breakpoint:

```css
/* Base / Desktop Experience (> 768px) */
.scene-image,
.entry-backdrop {
  --scene-art: url("assets/images/veranda-monsoon.webp");
}

/* Mobile Experience (<= 768px) */
@media (max-width: 768px) {
  .scene-image,
  .entry-backdrop {
    --scene-art: url("assets/images/veranda-monsoon-mobile.webp");
  }
}
```

*Why this is safe:* Both `::before` (blurred edge bleed) and `::after` (sharp center framing) inherit `--scene-art`. On mobile, both layers will consume the lightweight 29 KB asset, cutting memory footprint by 91%.

### 2.4 Preload Strategy & Loading Priority Update

Update `index.html` to pair responsive preloading with appropriate priority:

```html
<!-- Responsive Preload for LCP Hero Element -->
<link
  rel="preload"
  href="assets/images/veranda-monsoon-mobile.webp"
  as="image"
  type="image/webp"
  media="(max-width: 768px)"
  fetchpriority="high"
/>
<link
  rel="preload"
  href="assets/images/veranda-monsoon.webp"
  as="image"
  type="image/webp"
  media="(min-width: 769px)"
  fetchpriority="high"
/>
```

*Why `fetchpriority="high"` is now appropriate:*
Previously, `fetchpriority="low"` was set to prevent the 350 KB JPEG from choking the socket before stylesheets and scripts arrived. With the mobile asset reduced to **29 KB**, it can be downloaded in ~145ms on slow 4G without competing with critical CSS, ensuring the LCP visual element is painted at the earliest possible instant.

---

## 3. Visual Quality & Compatibility Safeguards

### 3.1 Visual Nuances of the Dark Monsoon Scene
The hero artwork depicts a dimly lit veranda with subtle rain streaks, warm chai lantern glow, and dark night-sky gradients.
- **Risk:** Poor lossy compression can introduce visible color banding (posterization) in deep shadow gradients or blur the fine raindrops on glass.
- **Safeguard 1 (Quality Floor):** Keep WebP quality $\ge 80$ (target Q82). Scratch benchmarks confirm that at Q82, PSNR remains above 43.5 dB, which is visually indistinguishable from the source JPEG.
- **Safeguard 2 (`libsharpyuv`):** Use `cwebp` with the `-sharp_yuv` flag. This uses sharper RGB-to-YUV chroma conversion, preserving edge contrast on rain droplets against dark wood.
- **Safeguard 3 (Source Preservation):** Keep the original `assets/images/veranda-monsoon.jpg` untouched in Git as the lossless master source.

### 3.2 Browser Compatibility
- Modern WebP support is standard across iOS Safari (14+), Android Chrome, desktop Chrome, Firefox, and Edge.
- If legacy fallback is desired for rare pre-2020 browsers, CSS `@supports (background-image: url("...webp"))` can guard the WebP declaration while leaving the JPEG as the default rule.

---

## 4. Proposed Files Likely to Change in Implementation

When approved for implementation, only the following files should be modified or created:

| File Path | Action | Description |
|---|:---:|---|
| `assets/images/veranda-monsoon.webp` | **Create** | High-resolution WebP hero asset (1672×941, ~86–113 KB) |
| `assets/images/veranda-monsoon-mobile.webp` | **Create** | Mobile-optimized WebP hero asset (836×470, ~29 KB) |
| `index.html` | **Edit** | Update `<link rel="preload">` tags with responsive media queries and `fetchpriority="high"` |
| `style.css` | **Edit** | Update `--scene-art` declarations and add `@media (max-width: 768px)` override |
| `assets/images/veranda-monsoon.jpg` | **Retain** | Kept intact as original master and fallback asset |

*Zero changes to playlist data, runtime manifest, audio engines, or playback logic.*

---

## 5. Separate JavaScript Performance Follow-Up Plan

### 5.1 Evidence of the JavaScript / Startup Cost
The performance audit revealed that while LCP is bounded by image size, **cold-load Total Blocking Time (TBT) fluctuates between 130 ms and 1,860 ms**, causing mobile Performance scores to vary between 57 and 90.

Diagnostics from Lighthouse traces identify specific startup costs:
1. **Parser-Blocking Script Tags:**
   In `index.html` (lines 486–488):
   ```html
   <script src="playlist.js?v=hindi-catalog-20261016-5"></script>
   <script src="hindi-playback-eligibility.js?v=verified-hindi-20261028-1"></script>
   <script src="share-context.js?v=verified-hindi-20261016-1"></script>
   ```
   These three scripts execute synchronously before `script.js` (which has `defer`). `playlist.js` is **188.8 KB uncompressed** containing 1,365 song objects. Parsing and evaluating this large object literal blocks the HTML parser.
2. **Main-Thread Style & Script Execution under 4× CPU Slowdown:**
   - Style & Layout work: **1,502 ms**
   - Script Evaluation: **582 ms**
   - Largest long tasks during boot: 909 ms and 814 ms.
3. **Clarifications:**
   - **Service Worker:** Confirmed **absent** from codebase (no `serviceWorker.register` exists; `site.webmanifest` only).
   - **YouTube IFrame API:** Confirmed **lazily initialized** on user interaction (`#enterButton`), not contributing to startup TBT.

### 5.2 Standalone JavaScript Follow-Up Steps (Post-Image Phase)
Do not combine JavaScript architectural changes with image optimization. Once the hero image is optimized, execute this separate investigation:

- **Investigation 1: Script Loading Attributes:** Test adding `defer` to `playlist.js`, `hindi-playback-eligibility.js`, and `share-context.js` to ensure the HTML parser reaches the DOM without stalling.
- **Investigation 2: Script Minification Feasibility:** Measure parse/compile time differences between unminified source and minified builds for `playlist.js` and `script.js`.
- **Investigation 3: Defer Heavy Effects Setup:** In `script.js` (`initialize()`), defer initializing canvas particle loops (`entryRainCanvas`, `rainCanvas`) until after the first visual paint via `requestAnimationFrame` or `requestIdleCallback`.

---

## 6. Exact Before / After Test Plan

To verify the impact of the hero image optimization, adhere to this repeatable test procedure:

### 6.1 Baseline Reference Metrics
- **Environment:** Chrome 156 (Headless), Lighthouse 11.7.1, Moto G4 emulation (412×823, DPR 1.75), Simulated 4G (1638.4 Kbps, 150ms RTT, 4× CPU slowdown).
- **Baseline Mobile Metrics (Cold Cache):**
  - Performance: 79–89 (cold median = 80)
  - LCP: **2.5 s – 2.9 s**
  - Hero Transfer Size: **350 KB**
- **Baseline Desktop Metrics:**
  - Performance: **100**
  - LCP: **0.6 s**

### 6.2 Post-Implementation Test Protocol
1. **Local Smoke Test:**
   - Verify landing page visual appearance on mobile viewport (412px width) and desktop viewport (1920px width).
   - Confirm rain canvas and visual layers composite properly over both WebP variants.
   - Verify browser console has zero 404s, CORS warnings, or decoding errors.
2. **Lighthouse Audit Runs:**
   - Execute **3 consecutive Mobile audits** with cold cache (storage reset) under simulated 4G and 4× CPU slowdown.
   - Record FCP, LCP, TBT, CLS, Speed Index, and Performance score for each run. Calculate median.
   - Execute **1 Desktop audit** to ensure desktop score remains at 99–100.
3. **Validation Criteria:**
   - Mobile LCP must drop below **2.0 seconds** (target: $\le 1.8\text{ s}$).
   - Network panel must verify `veranda-monsoon-mobile.webp` transfers at $\le 35\text{ KB}$ on mobile viewports.
   - Mobile Performance score floor should rise from the 57–79 band into the 88–95 band.

---

## 7. Implementation Sequence & Next Steps

When authorized to proceed with implementation, execute in this exact sequence:

1. **Step 1 — Asset Generation:**
   Generate `veranda-monsoon.webp` (Q85) and `veranda-monsoon-mobile.webp` (Q80, 836w) in `assets/images/` using `cwebp -sharp_yuv`.
2. **Step 2 — Visual Verification:**
   Verify visual quality, color depth, and absence of gradient banding using the local browser.
3. **Step 3 — CSS & HTML Integration:**
   Update `style.css` custom property rules with the `@media (max-width: 768px)` block, and update `index.html` preloads.
4. **Step 4 — Automated Verification:**
   Run full test suite (`npm test`) to confirm no test regressions.
5. **Step 5 — Lighthouse Performance Validation:**
   Run 3 mobile Lighthouse audits + 1 desktop audit and compare against baseline.
6. **Step 6 — Final Documentation:**
   Update documentation with measured results.

---
*End of Plan. Awaiting user authorization before modifying any project files.*
