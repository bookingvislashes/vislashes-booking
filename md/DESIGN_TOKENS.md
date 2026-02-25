# Design Tokens — VIS Lashes Brand System

## Brand Identity

VIS Lashes is a premium, intimate lash extension brand. The design should feel warm, elegant, and feminine — like a luxury beauty boutique, not a corporate website.

## Colors

Define these as CSS custom properties in `globals.css` AND as Tailwind theme extensions in `tailwind.config.ts`.

```css
:root {
  --color-cream: #F5F0EB;
  --color-warm-beige: #D4B896;
  --color-deep-brown: #8B6F47;
  --color-dark-brown: #3D2B1F;
  --color-charcoal: #2C2C2C;
  --color-white: #FFFFFF;
  --color-light-tan: #E8DDD0;
  --color-success: #4A7C59;
  --color-danger: #C44536;
  --color-muted: #9A9A9A;
}
```

```typescript
// tailwind.config.ts
const config = {
  theme: {
    extend: {
      colors: {
        cream: "#F5F0EB",
        "warm-beige": "#D4B896",
        "deep-brown": "#8B6F47",
        "dark-brown": "#3D2B1F",
        charcoal: "#2C2C2C",
        "light-tan": "#E8DDD0",
        success: "#4A7C59",
        danger: "#C44536",
        muted: "#9A9A9A",
      },
    },
  },
};
```

### Color Usage
| Element | Color |
|---------|-------|
| Page backgrounds | `cream` |
| Card backgrounds | `white` |
| Subtle section backgrounds | `light-tan` |
| Primary buttons, links, accents | `deep-brown` |
| Headings, dark text | `dark-brown` |
| Body copy | `charcoal` |
| Decorative accents, section backgrounds | `warm-beige` |
| Labels, secondary text, placeholders | `muted` |
| Success states, completed badges | `success` |
| Error states, cancel buttons, danger | `danger` |

## Typography

```bash
# Import via next/font/google in app/layout.tsx
import { Playfair_Display, DM_Sans } from "next/font/google";
```

| Usage | Font | Weight | Size |
|-------|------|--------|------|
| Hero headings | Playfair Display | 400 (regular) | 36-48px |
| Section headings | Playfair Display | 700 (bold) | 22-28px |
| Card titles | Playfair Display | 700 | 14-18px |
| Body text | DM Sans | 400 | 14-16px |
| Labels, captions | DM Sans | 600 | 11-13px |
| Buttons | DM Sans | 600 | 13-14px |
| Brand logo text | Playfair Display | 700 | 14px, letter-spacing: 3px |

### Brand Logo Treatment
The brand name renders as text, not an image:
```
VIS (regular weight) + LASHES (italic)
```
In code: `VIS` in regular, `LASHES` in italic, both Playfair Display, uppercase, letter-spacing: 3px.

## Spacing & Layout

| Element | Value |
|---------|-------|
| Page max-width (client-facing) | 640px |
| Page max-width (admin) | 1100px |
| Section vertical padding | 48-80px |
| Card border-radius | 8px |
| Input border-radius | 4px |
| Button border-radius | 6px |
| Card box-shadow | `0 1px 4px rgba(0,0,0,0.06)` |
| Input border color | `light-tan` |
| Divider/separator color | `light-tan` |

## Button Styles

### Primary Button
```
Background: deep-brown
Text: white
Font: DM Sans 600, 14px
Padding: 12px 28px
Border-radius: 6px
Hover: slightly darker (darken 10%)
Disabled: muted background, not-allowed cursor
```

### Secondary Button
```
Background: transparent
Border: 1.5px solid deep-brown
Text: deep-brown
Same font, padding, radius as primary
Hover: light-tan background
```

### Status Badges
```
Confirmed: deep-brown text on deep-brown/15 background
Completed: success text on success/15 background
Cancelled: danger text on danger/15 background
No-show: muted text on muted/15 background
Pill shape: border-radius 20px, padding 4px 10px, font-size 11px, font-weight 600
```

## Form Elements

- Inputs: white background, `light-tan` border, 10px 12px padding, 14px font
- Focus state: `deep-brown` border, subtle shadow
- Labels: `dark-brown`, 12px, font-weight 600, 4px margin-bottom
- Error text: `danger` color, 12px, appears below input
- Checkboxes: accent-color `deep-brown`
- Radio buttons: accent-color `deep-brown`

## Progress Bar

7 horizontal segments with 6px gap. Each segment is 4px tall with 2px border-radius. Completed steps use `deep-brown`, remaining steps use `light-tan`.

## Responsive Breakpoints

Mobile-first. Use Tailwind's default breakpoints:
- Default: mobile (< 640px)
- `sm`: 640px
- `md`: 768px
- `lg`: 1024px

Admin sidebar collapses to bottom nav on mobile.
Service cards: 1 column mobile, 3 columns tablet+.
Time slots: 3 columns always.

## Animation

Keep it subtle and refined. No bouncy or playful animations.
- Page transitions: none (instant navigation)
- Step transitions: simple opacity fade (150ms ease)
- Button hover: 150ms ease for color change
- Card selection: 200ms ease for border/shadow change
- Confirmation checkmark: gentle scale-up from 0.8 to 1 (300ms ease-out)
