# Home/Form Styling Guide

This document captures the current look-and-feel patterns on the Home submission form (Page 1 + Page 2) so they can be reused on organizer views for visual consistency.

## Scope

- Main source: Home form UI in [src/views/HomeView.vue](src/views/HomeView.vue)
- Shared style primitives: [src/styles/form-section.css](src/styles/form-section.css)
- Related components:
  - [src/components/IngredientSearch.vue](src/components/IngredientSearch.vue)
  - [src/components/IngredientList.vue](src/components/IngredientList.vue)
  - [src/components/IngredientRow.vue](src/components/IngredientRow.vue)
  - [src/components/CountrySelect.vue](src/components/CountrySelect.vue)
  - [src/components/YesNoSelect.vue](src/components/YesNoSelect.vue)
  - [src/components/IngredientThumb.vue](src/components/IngredientThumb.vue)
  - [src/components/DietaryIcons.vue](src/components/DietaryIcons.vue)

---

## 0) Pill style system (look + feel)

### Base pill

- Shape: fully rounded capsule (border-radius 9999px)
- Height: min-height 2.75rem
- Surface: white background, thin neutral border (1px)
- Layout: centered content using flex alignment
- Typography baseline: medium-weight text (500) for most pill contexts

Defined in [src/styles/form-section.css](src/styles/form-section.css).

### Pill variants

- **Label pill** (`.form-section-pill-label`)
  - Purpose: section titles and prominent labels (e.g., Grocery Submission Form, Dish Details)
  - Background: Lafayette red
  - Text: white
  - Border: same red tone
  - Width behavior: min-width 10rem
  - Vertical rhythm: line-height 2.5rem (same visual height language as inputs)

- **Input-hosting pill** (`.form-section-pill:has(.form-section-pill-input)`)
  - Purpose: wraps text inputs/select controls
  - Width behavior: flexible (`flex: 1 1 0`) with min-width 5rem
  - Internal spacing: compact horizontal pill padding to keep controls clean and centered

- **Search pill container** (`.form-section-pill-search`)
  - Purpose: dedicated area for ingredient search
  - Width behavior: fills remaining horizontal space in top bars

### Input text inside pills

- Input itself is borderless and transparent to preserve pill silhouette
- Full-width behavior with inherited font family/size
- Placeholder style: gray at reduced opacity for a soft prompt feel
- Inputs are visually centered in the pill via consistent line-height

---

## 1) Button style system (Next / Back / Submit)

### Shared button style

- Classes: `.btn-pill-primary` and `.btn-pill-secondary`
- Shape: pill/capsule (border-radius 9999px)
- Height: min-height 2.75rem
- Padding: 0.5rem 1.5rem
- Typography: font-size 1.25rem, weight 500
- Interaction: subtle transition on background/color/opacity

Defined in [src/styles/form-section.css](src/styles/form-section.css).

### Primary actions (used on Home form)

- Class: `.btn-pill-primary`
- Default state:
  - Lafayette red background
  - White text
  - 1px matching border
- Hover state:
  - switches to dark blue background/border
- Focus-visible:
  - 2px outline for keyboard accessibility
- Disabled:
  - neutral gray surface/text/border with not-allowed cursor and reduced opacity

### Placement and behavior by page

- **Page 1** (Next): right-aligned in ingredient footer row (`.ingredient-list-footer`)
- **Page 2** (Back + Submit): footer uses `space-between` so Back sits left and Submit sits right
- Error message (if present) is centered between action buttons on Page 2

---

## 2) Section composition (title pill + input pills)

### Section containers

- Repeated shell style across header, reminders, and form bars:
  - full width
  - rounded panel corners (1rem)
  - soft gray background (`var(--color-menu-gray)`)
  - inner padding 0.75rem 1rem
- Primary wrappers:
  - `.home-header`
  - `.home-reminders-section`
  - `.home-dish-bar`
  - `.form-section-ingredients`

Main structure in [src/views/HomeView.vue](src/views/HomeView.vue).

### Section inner layout

- Section rows use wrapping horizontal flex layout
- Common spacing: 0.75rem between pills
- Outer page spacing: 1rem gap between major sections
- This creates a compact but airy, modular form rhythm

### Title pill + input pill relationship

- Title pill anchors each section visually using maroon contrast
- Inputs/selects sit in adjacent white pills with matching height and corner radius
- Input pills can be fixed or grow to consume remaining width depending on context
- This keeps hierarchy clear: title first, editable controls second

### Additional details page (Page 2)

- Same top-bar/pill language is reused for:
  - Additional Details
  - Other Ingredients
  - Cooking Location
  - Utensils/Equipment
- Conditional sections appear/disappear without changing styling pattern

---

## 3) Search bar and ingredient display patterns

### Search input (in Grocery List bar)

- White rounded input, full width, min-height 2.75rem
- Borderless shell (the parent pill and dropdown carry structure)
- Placeholder is muted gray

In [src/components/IngredientSearch.vue](src/components/IngredientSearch.vue).

### Search dropdown shell

- Anchored directly below input (`top: calc(100% + 0.25rem)`)
- White panel with:
  - 1px gray border
  - 0.75rem corner radius
  - elevated shadow
  - high z-index
- Vertical layout with optional category pills, then scrolling result list
- Max height: tall scroll container for long result sets

### Search result row (product in dropdown)

Each row (`.search-result-item`) is a compact horizontal flex row:

1. Ingredient thumbnail (2.5rem square)
2. Main info block:
   - product name (larger text)
   - size/subtext (slightly smaller gray text)
3. Optional price block (right aligned visual endpoint)

Interaction feel:

- Row hover uses subtle maroon-tinted background
- Fast hover transition for responsive, lightweight feedback

### Added ingredient row (product in list)

In [src/components/IngredientRow.vue](src/components/IngredientRow.vue):

- White card row with soft border, mild shadow, rounded corners
- Horizontal structure:
  1. Thumbnail
  2. Name/size text block
  3. Dietary icon cluster
  4. Quantity controls (editable mode) or readonly quantity/price
- Hover on row increases contrast/shadow slightly for “lift” effect

In [src/components/IngredientList.vue](src/components/IngredientList.vue):

- Rows stack in a vertical scrollable list with 0.5rem gaps
- Empty state uses centered muted text

---

## 4) Quantity controls (minus / number / plus)

Defined centrally in [src/styles/form-section.css](src/styles/form-section.css), used in [src/components/IngredientRow.vue](src/components/IngredientRow.vue).

### Visual style

- Control group (`.qty-controls`) is inline-flex, centered, with tight gap (0.375rem)
- Buttons (`.qty-btn`):
  - circular (9999px)
  - fixed size 2rem x 2rem
  - white background
  - dark gray border
  - glyph-size tuned for compact clarity
- Number (`.qty-num`):
  - centered text
  - min-width 1.5rem to avoid jumping with digit changes
  - tabular numerals for stable alignment

### Placement relative to number

- Number is always centered between minus and plus
- Minus and plus have equal size and spacing from the number
- Entire control cluster sits as one right-side action unit in each ingredient row

### Interaction

- Hover on each quantity button switches to dark blue with white text
- Focus-visible outline supports keyboard usage

---

## 5) Other reusable components/patterns to carry into organizer pages

### Dropdown select pattern family

- Country selector: [src/components/CountrySelect.vue](src/components/CountrySelect.vue)
- Yes/No selector: [src/components/YesNoSelect.vue](src/components/YesNoSelect.vue)

Shared characteristics:

- Pill-like trigger button inside white pill shell
- Small chevron indicator with reduced emphasis
- Floating white dropdown panel with border + shadow + rounded corners
- Option hover/selected states use subtle maroon tints

### Thumbnail + metadata pattern

- Thumbnail primitive: [src/components/IngredientThumb.vue](src/components/IngredientThumb.vue)
- Name/size text pairing appears in both search results and selected list rows

### Dietary badge cluster

- Reusable icon group: [src/components/DietaryIcons.vue](src/components/DietaryIcons.vue)
- Inline, compact, neutral-toned icon treatment that does not overpower primary text

### Form panel rhythm

- Reusable panel look:
  - gray rounded section shell
  - maroon title pill + white control pills
  - consistent gaps and heights
- This rhythm is the strongest visual identity to replicate on organizer pages

### Home-specific but reusable micro-patterns

- Reminders collapsible title pill + chevron behavior in [src/views/HomeView.vue](src/views/HomeView.vue)
- Inline validation hazard icon for phone input in [src/views/HomeView.vue](src/views/HomeView.vue)

---

## Practical alignment checklist for organizer tab restyling

When styling organizer views to match Home:

1. Reuse shared classes from [src/styles/form-section.css](src/styles/form-section.css) first.
2. Keep panel shell + title-pill + input-pill hierarchy intact.
3. Keep action buttons in pill form with same interaction states.
4. Use the same dropdown shell/option treatments for new selectors.
5. Keep ingredient/search row anatomy consistent (thumb, text hierarchy, action cluster).
6. Preserve quantity control geometry and spacing exactly.
