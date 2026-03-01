# Grocery List Mobile Scroll — What Didn't Work

## The Problem
On the Organizer Dashboard's **Grocery List** tab, when 2-3 aisle cards are expanded on a phone, scrolling hits a wall and the user cannot reach the bottom cards.

## Layout Chain (top to bottom)
1. `html` / `body` / `#app` — all `height: 100%` (overridden to `height: auto; min-height: 100%` at `max-width: 600px` in `src/assets/base.css`)
2. `.app-outer` (`src/App.vue`) — `min-h-screen flex flex-col md:h-screen md:overflow-hidden`
3. `.app-main` (`src/App.vue`) — `flex-col flex-1 min-h-0 md:overflow-hidden`
4. `.lock-container` (`src/components/LockOverlay.vue`) — `relative w-full md:h-full`
5. `.dashboard` (`OrganizerDashboardView.vue`) — `md:h-full flex flex-col`
6. `.dashboard-body` (`OrganizerDashboardView.vue`) — `flex: 1; overflow-y: scroll; min-height: 0`

## Key Discovery
Tailwind `md:h-screen` and `md:overflow-hidden` on `.app-outer` and `.app-main` compile **without** a `@media` wrapper in the production CSS. This means `height: 100vh` and `overflow: hidden` apply at **all** screen sizes, not just `≥768px`. This is likely a Tailwind v4 compilation issue or misconfiguration.

As a result, even though `dashboard-body` has `overflow-y: visible !important; flex: none !important; height: max-content` on mobile, parent elements above it clip the content.

## Attempts

### 1. `dashboard-body` overrides only (scoped CSS, `max-width: 600px`)
```css
.dashboard-body {
  overflow-y: visible !important;
  flex: none !important;
  height: max-content;
}
```
**Result:** Did not work. Parent elements (`app-outer`, `app-main`) still have `height: 100vh` and `overflow: hidden` from the broken `md:` utilities, clipping all content beyond the viewport.

### 2. Override `app-main` from `base.css` `@layer base`
```css
@media (max-width: 600px) {
  .app-main {
    flex: 1 1 auto;
    min-height: auto;
  }
}
```
**Result:** Did not work. Tailwind utilities are in `@layer utilities` which has higher specificity than `@layer base`. The override was silently ignored.

### 3. Same as #2 but with `!important`
```css
.app-main {
  flex: 1 1 auto !important;
  min-height: auto !important;
}
```
**Result:** Did not work. Even with `!important` in `@layer base`, the flex parent chain still constrained the height.

### 4. Scoped overrides in `App.vue` `<style scoped>` with `!important`
```css
@media (max-width: 600px) {
  .app-outer {
    height: auto !important;
    min-height: 100vh;
    overflow: visible !important;
  }
  .app-main {
    flex: none !important;
    min-height: 0 !important;
    overflow: visible !important;
  }
}
```
**Result:** Did not work. The scoped data-attribute selector beat Tailwind specificity, and the compiled output confirmed the rules were present and correct. But the scroll was still blocked — possibly because `flex: none` with `min-height: 0` doesn't let the element grow from its children, or because another element in the chain is clipping.

### 5. `position: fixed; inset: 0` on `.dashboard` with internal scroll on `dashboard-body`
```css
@media (max-width: 600px) {
  .dashboard {
    position: fixed !important;
    inset: 0 !important;
    z-index: 10;
  }
  .dashboard-body {
    flex: 1 !important;
    min-height: 0 !important;
    overflow-y: auto !important;
  }
}
```
**Result:** Made the dashboard take over the whole screen, hiding the header and breaking the layout. Reverted immediately.

### 6. Remove `md:` classes from template, replace with scoped CSS media queries
Removed `md:h-screen md:overflow-hidden` from `.app-outer` and `md:overflow-hidden` from `.app-main` in the template. Added equivalent rules inside `@media (min-width: 601px)` in scoped CSS.

**Result:** Fixed the grocery scroll but **broke scroll on every other page** (home/submission form). The `md:` classes were needed for the desktop layout of all pages, not just the organizer. Reverted immediately.

## Current State
- `App.vue` is back to its original state with `md:h-screen md:overflow-hidden` on `.app-outer` and `md:overflow-hidden` on `.app-main`
- `base.css` has the `html, body, #app { height: auto; min-height: 100% }` override at `max-width: 600px`
- `OrganizerDashboardView.vue` has `dashboard-body` overrides at `max-width: 600px` (`overflow-y: visible !important; flex: none !important; height: max-content`)
- The grocery list scroll issue on mobile **remains unfixed**

## Suggestions for Next Attempt
- The root cause is that `md:h-screen` and `md:overflow-hidden` compile without media queries in Tailwind v4. Fixing the Tailwind config so `md:` prefixes properly produce `@media (min-width: 48rem)` wrappers would solve this globally.
- Alternatively, a JS-based approach could dynamically set `height: auto` and `overflow: visible` on `app-outer` and `app-main` only when the organizer dashboard is mounted on a mobile device, and restore on unmount.
- Another approach: keep the desktop flex layout but on mobile, make `dashboard-body` use `-webkit-overflow-scrolling: touch` with a calculated `max-height` (e.g., `calc(100vh - <header+tabs height>)`) so it scrolls internally without depending on parent overflow.
