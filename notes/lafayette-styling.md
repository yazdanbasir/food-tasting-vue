# Lafayette Styling Reference

Design language, typography, color, and UI patterns distilled from two Lafayette sites.

---

# Lafayette Magazine
https://magazine.lafayette.edu/

## Design Language

*Modern liberal arts editorial.* Serif body text pairs with bold geometric sans-serif headlines for a contemporary-yet-academic feel. Generous whitespace, fluid CSS spacing, and a red-anchored palette with cool blue accents. Archival and bicentennial motifs surface through timeline components and interactive elements.

---

## Typography

### Fonts

| Font | Role |
|------|------|
| **Tiempos** (serif) | Body / editorial prose |
| **Midnight Sans RD** | H1 display, buttons, CTAs |
| **LabGrotesque** (weight 800) | H2–H6 headings |
| **LabGrotesque Mono** | Monospace / code alternative |
| System fallback | `-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif` |

### Type Scale (fluid / clamp-based)

```
H1:   clamp(2.625rem, 2.625rem + ((1vw - 0.48rem) × 8.4135), 3rem)
H2:   clamp(1.75rem,  1.75rem  + ((1vw - 0.48rem) × 8.4135), 2rem)
Body: clamp(1.125rem, 1.125rem + ((1vw - 0.2rem) × 0.227),  1.25rem)
Line-height (body):     1.75rem
Line-height (headings): 2.25rem
```

---

## Color Palette

| Name | Hex | Usage |
|------|-----|-------|
| Lafayette Red | `#910029` | Primary brand, buttons, accents, timeline borders |
| Lafayette Blue | `#1da9d7` | Secondary accent, active states |
| Lafayette Dark Blue | `#006690` | Hover states |
| Lafayette Light Blue | `#86ccff` | Decorative accent |
| White | `#FFFFFF` | Base background |
| Black | `#000000` | High-contrast text |
| Lafayette Gray | `#3c373c` | Supporting / secondary text |
| Lafayette Tan | `#e8ba81` | Warm accent |
| Menu Gray | `#e5e3e0` | UI surface backgrounds |

---

## Spacing (fluid tokens)

```
--spacing-30: clamp(1.5rem, 5vw, 2rem)
--spacing-40: clamp(1.8rem, 1.8rem + ((1vw - 0.48rem) × 2.885), 3rem)
--spacing-50: clamp(2.5rem, 8vw, 4.5rem)
--spacing-60: clamp(3.75rem, 10vw, 7rem)
Block gap:      1.5rem (default)
Global padding: 2rem (left/right)
```

---

## Buttons

```css
.btn {
  background-color: #910029;
  color: #ffffff;
  font-family: "Midnight Sans RD";
  border: none;
  border-radius: 9999px;
  padding: calc(0.667em + 2px) calc(1.333em + 2px);
}
.btn:hover  { background-color: #006690; }
.btn:focus  { background-color: #000000; }
.btn:active { background-color: #1da9d7; }
```

---

## Links

```css
a { color: inherit; text-decoration: underline; }
a:hover  { text-decoration: none; }
a:focus  { text-decoration: underline dashed; }
a:active { color: #1da9d7; text-decoration: none; }
```

---

## Cards

- Featured image fills the container
- Title: H2 style (LabGrotesque bold)
- Excerpt below title
- Padding: `--spacing-30`

---

## Shadows

```css
/* Natural  */ box-shadow: 6px 6px 9px rgba(0, 0, 0, 0.2);
/* Deep     */ box-shadow: 12px 12px 50px rgba(0, 0, 0, 0.4);
/* Sharp    */ box-shadow: 6px 6px 0px rgba(0, 0, 0, 0.2);
/* Outlined */ box-shadow: 6px 6px 0px -3px rgba(255,255,255,1),
                           6px 6px rgba(0, 0, 0, 1);
```

---

## Layout & Grid

```css
.post-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
}
```

### Responsive Breakpoints

```
Mobile:  max-width: 600px
Tablet:  768px – 1023px
Laptop:  1024px – 1439px
Desktop: 1440px+
```

---

## Navigation

- Horizontal top bar, logo left, search right
- Mobile: vertical flex column, left-aligned
- Dropdowns for sub-menus
- Active / hover: `text-decoration: underline`
- Focus: `text-decoration: underline dashed`

---

## Special Components

### Timeline
```css
.timeline { border-top: 3px solid #910029; }
/* Alternating dot colors: #910029 (red) and #1da9d7 (blue) */
/* Caption background matches dot color */
/* Uses writing-mode: vertical-lr for rotated labels */
```

### Tooltip
```css
.tooltip {
  border-radius: 50%;
  border: 2px solid #000;
  background: #fff;
  font-size: 1.75rem;
}
```

### Separator / Divider
- Default: `1px solid` border
- Dots variant: centered with letter-spacing

---

## Image Treatment

- Responsive: `max-width: 100%; height: auto;`
- Featured images fill their parent container
- Aspect ratio controlled via `clamp()`
- Hover overlays on cards

---
---

# Lafayette Main Site
https://www.lafayette.edu/

## Design Language

*Clean institutional academic.* Whitney SmallCaps anchors the collegiate brand identity. Structured grids with constrained max-widths keep content organized. Dark Blue is the primary interactive color. Thick-border cards give structure and weight to content blocks. Professional and restrained — imagery and content lead.

---

## Typography

### Fonts

| Font | Role |
|------|------|
| **Whitney SSm SmallCaps** | Primary decorative / branding headings |
| System sans-serif | Body fallback |

### Type Scale (fixed)

```
Small:   13px
Medium:  20px
Large:   36px
X-Large: 42px
```

### Heading Effect

```css
text-shadow: 4px 1px 0 rgba(0, 0, 0, 0.6);
```

---

## Color Palette

| Name | Hex | Usage |
|------|-----|-------|
| Lafayette Dark Blue | `#006690` | Primary interactive / accent / hover |
| Dark | `#1e1e1e` | Borders, card edges |
| Dark Charcoal | `#32373c` | Button background |
| Dark Gray Text | `#757575` | Muted / caption text |
| Cyan-Bluish-Gray | `#abb8c3` | Subtle backgrounds |
| White | `#FFFFFF` | Base background |
| Black | `#000000` | High-contrast text |

---

## Spacing (fixed scale)

```
20: 0.44rem
30: 0.67rem
40: 1rem
50: 1.5rem
60: 2.25rem
70: 3.38rem
80: 5.06rem
Grid gap: 0.5em
```

---

## Buttons

```css
.btn {
  background-color: #32373c;
  color: #ffffff;
  border-radius: 9999px;
  padding: calc(0.667em + 2px) calc(1.333em + 2px);
}
```

---

## Cards

### Standard Card
```css
.card {
  border-left:   2px solid #1e1e1e;
  border-right:  2px solid #1e1e1e;
  border-top:    5px solid #1e1e1e;
  border-bottom: 5px solid #1e1e1e;
}
```

### Circular Image Element
```css
.circle {
  width: 200px;
  height: 200px;
  border-radius: 1000px;
  background-size: cover;
}
.circle:hover::after {
  background: rgba(0, 0, 0, 0.35);
  opacity: 1;
  transition: opacity 200ms;
}
@media (max-width: 600px) {
  .circle { width: 125px; height: 125px; }
}
```

---

## Shadows

```css
/* Natural */ box-shadow: 6px 6px 9px rgba(0, 0, 0, 0.2);
/* Deep    */ box-shadow: 12px 12px 50px rgba(0, 0, 0, 0.4);
/* Sharp   */ box-shadow: 6px 6px 0px rgba(0, 0, 0, 0.2);
```

---

## Layout & Grid

```css
.hero { min-height: 90vh; }
```

- Flexbox and CSS Grid throughout
- Constrained max-width on content columns
- `0.5em` gaps between grid cells

---

## Navigation

- Horizontal top bar, logo + search + main nav
- Dropdown submenus supported
- Multi-column footer with quick links, social icons, contact info
