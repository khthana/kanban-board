# Kanban Card Spec — Option C "Editorial"

> Implementation spec for the chosen Kanban card design (Option C, type-forward "Editorial" style).
> Audience: an engineer or coding LLM implementing the card + board shell from scratch.
> All values are literal and final — copy them exactly. Colors use the **OKLCH** color space.

---

## 1. Overview

A Kanban board with four columns (Ideas / Todo / Doing / Done). Each column holds **cards**. This spec
defines the **card** in full and the **board shell** it lives in. Visual language is *editorial*:
type-forward, generous whitespace, an uppercase category label with a colored dot, a hairline divider,
and a checklist-progress indicator that adapts to subtask count.

- **Soft pastel** palette. White cards on tinted columns.
- **Thai-first typography** — must render Thai and Latin cleanly.
- Static visual spec (no interaction behavior required), but hover/empty/complete states are documented.

---

## 2. Design tokens

### 2.1 Typography
| Token | Value |
|---|---|
| Font family | `'IBM Plex Sans Thai', 'IBM Plex Sans', system-ui, sans-serif` |
| Weights used | 400, 500, 600, 700 |
| Smoothing | `-webkit-font-smoothing: antialiased` |

Load (Google Fonts):
```
https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Thai:wght@400;500;600;700&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap
```

### 2.2 Neutral / ink palette
| Token | Value | Use |
|---|---|---|
| `--ink` | `oklch(0.27 0.02 265)` | Primary text (titles) |
| `--ink-soft` | `oklch(0.50 0.02 265)` | Secondary text (due date) |
| `--ink-faint` | `oklch(0.62 0.015 265)` | Tertiary text (counts, muted) |
| `--line` | `oklch(0.92 0.006 265)` | Borders, hairline divider |
| Board bg | `oklch(0.995 0.002 265)` | Page background |
| `--card-shadow` | `0 1px 2px oklch(0.4 0.03 265 / 0.06), 0 1px 1px oklch(0.4 0.03 265 / 0.04)` | Card elevation |

### 2.3 Accent colors (per-card, by category)
Each card carries one accent `color` key. Accents share lightness/chroma and vary by hue so the board
stays harmonious. Only two roles are used by Option C: **`solid`** (the dot + progress fill) and
**`text`** (the uppercase label). The other roles are listed for completeness / reuse.

| key | `solid` (dot, fill) | `text` (label) | `tint` | `border` | `pill` |
|---|---|---|---|---|---|
| `rose` | `oklch(0.74 0.13 18)` | `oklch(0.55 0.14 18)` | `oklch(0.965 0.022 18)` | `oklch(0.90 0.05 18)` | `oklch(0.93 0.055 18)` |
| `amber` | `oklch(0.78 0.11 75)` | `oklch(0.52 0.10 70)` | `oklch(0.967 0.028 75)` | `oklch(0.90 0.06 75)` | `oklch(0.93 0.06 75)` |
| `blue` | `oklch(0.70 0.12 255)` | `oklch(0.55 0.13 255)` | `oklch(0.965 0.022 250)` | `oklch(0.89 0.05 250)` | `oklch(0.93 0.05 250)` |
| `violet` | `oklch(0.70 0.13 300)` | `oklch(0.55 0.14 300)` | `oklch(0.965 0.022 300)` | `oklch(0.89 0.05 300)` | `oklch(0.93 0.05 300)` |
| `teal` | `oklch(0.72 0.10 195)` | `oklch(0.50 0.10 195)` | `oklch(0.965 0.022 195)` | `oklch(0.89 0.05 195)` | `oklch(0.93 0.05 195)` |
| `green` | `oklch(0.72 0.11 155)` | `oklch(0.50 0.11 155)` | `oklch(0.965 0.022 155)` | `oklch(0.89 0.05 155)` | `oklch(0.93 0.05 155)` |

### 2.4 Status accents (shared)
| State | Color |
|---|---|
| Due-soon text | `oklch(0.54 0.16 22)` (font-weight 600) |
| Complete (count) text | `oklch(0.58 0.12 155)` |
| Empty progress track | `oklch(0.91 0.006 265)` |

---

## 3. The Card (Option C "Editorial")

### 3.1 Anatomy (top → bottom)
1. **Top row** — category label (left) + assignee avatars (right), space-between.
2. **Title** — the task name. The visual hero of the card.
3. **Hairline divider** — 1px full-width rule.
4. **Foot row** — due date (left) + checklist progress (right), space-between.

### 3.2 DOM structure
```html
<div class="opt-c-card">
  <div class="opt-c-top">
    <span class="opt-c-label" style="color: {accent.text}">
      <span class="opt-c-dot" style="background: {accent.solid}"></span>
      LABEL
    </span>
    <!-- avatars, see §4 -->
    <div class="kb-avatars" style="--sz:24px"> … </div>
  </div>

  <div class="opt-c-title">Task title (Thai or Latin)</div>

  <div class="opt-c-rule"></div>

  <div class="opt-c-foot">
    <!-- DUE: one of three states -->
    <span class="opt-c-due"><!-- cal icon -->15 มิ.ย. 2569</span>
    <!-- or .opt-c-due.soon for due-soon, or .opt-c-due.muted with text "ไม่มีกำหนด" when no due date -->

    <!-- PROGRESS: see §3.4 -->
    <span class="opt-c-check"> … </span>
  </div>
</div>
```

### 3.3 Card + element styles (exact)
```css
.opt-c-card {
  background: #fff;
  border-radius: 15px;
  border: 1px solid var(--line);
  padding: 14px 15px;
  box-shadow: var(--card-shadow);
  display: flex; flex-direction: column; gap: 11px;
}
.opt-c-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.opt-c-label {
  display: inline-flex; align-items: center; gap: 7px;
  font-size: 10.5px; font-weight: 600;
  text-transform: uppercase; letter-spacing: 0.07em;
  /* color is set inline from accent.text */
}
.opt-c-dot { width: 7px; height: 7px; border-radius: 50%; /* background = accent.solid */ }
.opt-c-title {
  font-size: 16px; font-weight: 600; line-height: 1.3;
  color: var(--ink); letter-spacing: -0.005em;
}
.opt-c-rule { height: 1px; background: var(--line); }
.opt-c-foot { display: flex; align-items: center; justify-content: space-between; gap: 8px; }

.opt-c-due {
  display: inline-flex; align-items: center; gap: 5px;
  font-size: 12px; font-weight: 500; color: var(--ink-soft);
}
.opt-c-due.soon  { color: oklch(0.54 0.16 22); font-weight: 600; }
.opt-c-due.muted { color: oklch(0.72 0.01 265); }   /* "ไม่มีกำหนด" / no due date */

.opt-c-check { display: inline-flex; align-items: center; gap: 7px; }
.opt-c-count { font-size: 11.5px; font-weight: 600; color: var(--ink-faint); }
.opt-c-count.done { color: oklch(0.58 0.12 155); }   /* when done === total */

/* segmented progress (≤ 8 subtasks) */
.opt-c-segs { display: flex; gap: 3px; }
.opt-c-seg  { width: 11px; height: 4px; border-radius: 2px; background: oklch(0.91 0.006 265); }
.opt-c-seg.on { /* background = accent.solid (set inline) */ }

/* continuous mini-bar (> 8 subtasks) */
.opt-c-minibar  { width: 64px; height: 4px; border-radius: 2px; background: oklch(0.91 0.006 265); overflow: hidden; }
.opt-c-minifill { display: block; height: 100%; border-radius: 2px; /* width = pct%, background = accent.solid */ }
```

### 3.4 Checklist progress — adaptive (IMPORTANT)
The progress indicator **switches representation based on subtask count** so it never overflows the card.

- Let `SEG_MAX = 8`.
- `done` / `total` are the completed and total subtask counts.
- **If `total <= SEG_MAX`** → render **segments**: one `.opt-c-seg` per subtask. The first `done`
  segments get class `on` and `background: {accent.solid}`; the rest stay on the empty-track color.
- **If `total > SEG_MAX`** → render a single **mini-bar**: `.opt-c-minibar` track with `.opt-c-minifill`
  whose `width = round(done/total*100)%` and `background = {accent.solid}`.
- In **both** cases, follow the indicator with `<span class="opt-c-count">{done}/{total}</span>`.
  When `done === total`, add class `done` to the count (turns green).

Pseudocode:
```
pct = round(done / total * 100)
complete = (done === total)
if total <= 8:
    render <span.opt-c-segs> with `total` segs, first `done` marked .on
else:
    render <span.opt-c-minibar><span.opt-c-minifill style=width:pct%></span></span>
render <span.opt-c-count{.done if complete}>done/total</span>
```

### 3.5 Due-date states
| Condition | Markup | Visual |
|---|---|---|
| Has due date, normal | `<span class="opt-c-due">` + cal icon + text | ink-soft, weight 500 |
| Has due date, soon | `<span class="opt-c-due soon">` + cal icon + text | red `oklch(0.54 0.16 22)`, weight 600 |
| No due date | `<span class="opt-c-due muted">ไม่มีกำหนด</span>` (no icon) | grey `oklch(0.72 0.01 265)` |

"Due soon" is a per-card boolean (`dueSoon`) decided by the caller — this spec does not compute it from dates.

### 3.6 Hover (optional, recommended)
Cards are static in this spec. If adding interactivity, suggested hover:
`box-shadow` lift to `0 4px 12px oklch(0.4 0.03 265 / 0.10)` + `transform: translateY(-1px)`, 120ms ease.

---

## 4. Avatars (shared component)
```css
.kb-avatars { display: flex; }
.kb-avatar {
  width: var(--sz); height: var(--sz); border-radius: 50%;
  display: grid; place-items: center;
  font-size: calc(var(--sz) * 0.46); font-weight: 600; color: #fff;
  border: 2px solid #fff; margin-left: -7px;   /* overlap */
}
.kb-avatar:first-child { margin-left: 0; }
```
- Card uses `--sz: 24px`.
- Each avatar background = its own accent `solid` color. Content = 1 initial (Thai or Latin char).
- Overlapping stack, white ring separates them.

---

## 5. Board shell (column + header)

Cards live in columns. The board is **1360px wide** in the reference; columns are fluid (`flex: 1`),
so the board also works responsively — only the outer width and `+ Add column` block are fixed.

### 5.1 Columns
Four columns, each with its own accent:
| key | name | tint (column bg) | pill bg | pill text |
|---|---|---|---|---|
| `ideas` | Ideas | `oklch(0.978 0.013 32)` | `oklch(0.92 0.045 32)` | `oklch(0.52 0.12 32)` |
| `todo` | Todo | `oklch(0.979 0.011 250)` | `oklch(0.92 0.04 250)` | `oklch(0.46 0.10 255)` |
| `doing` | Doing | `oklch(0.979 0.012 300)` | `oklch(0.92 0.045 300)` | `oklch(0.48 0.12 300)` |
| `done` | Done | `oklch(0.979 0.011 155)` | `oklch(0.92 0.04 155)` | `oklch(0.44 0.10 155)` |

```css
.kb-columns { display: flex; gap: 18px; padding: 22px 26px 30px; align-items: flex-start; }
.kb-col {
  flex: 1 1 0; min-width: 0;
  border-radius: 16px; padding: 12px 12px 14px;
  min-height: 540px;
  display: flex; flex-direction: column; gap: 12px;
  /* background = column.tint */
}
.kb-col-head { display: flex; align-items: center; gap: 8px; padding: 2px 4px; }
.kb-grip { color: oklch(0.74 0.01 265); font-size: 12px; cursor: grab; }   /* ⠿ drag handle */
.kb-col-pill { font-size: 13px; font-weight: 600; padding: 3px 11px; border-radius: 8px;
  /* background = column.pill, color = column.pillText */ }
.kb-col-count { font-size: 13px; font-weight: 600; color: var(--ink-faint); }
.kb-col-actions { margin-left: auto; display: flex; gap: 9px; color: oklch(0.72 0.02 265); }  /* edit + delete icons */
.kb-cards { display: flex; flex-direction: column; gap: 10px; }
.kb-empty { text-align: center; color: var(--ink-faint); font-size: 13px; padding: 28px 0; }
.kb-newcard {
  border: none; background: none; text-align: left; cursor: pointer;
  color: var(--ink-soft); font: 500 13.5px var(--font);
  padding: 4px 6px; border-radius: 8px; margin-top: 2px;
}
.kb-newcard:hover { background: oklch(0.5 0.02 265 / 0.05); }
.kb-addcol {
  flex: 0 0 188px; align-self: stretch;
  border: 1.5px dashed oklch(0.85 0.01 265); border-radius: 16px;
  color: var(--ink-faint); font-size: 14px; font-weight: 500;
  display: flex; align-items: flex-start; justify-content: center;
  padding-top: 22px; min-height: 64px;
}
```
Column header order: `⠿ grip` · `name pill` · `count` · (push) `edit + delete icons`.
Below cards: a `+ New card` text button. After the four columns: a dashed `+ Add column` block.

### 5.2 Top bar
```css
.kb-topbar { height: 58px; display: flex; align-items: center; justify-content: space-between;
  padding: 0 26px; border-bottom: 1px solid var(--line); }
.kb-back { color: var(--ink-soft); font-size: 14px; font-weight: 500; }        /* "← Boards" */
.kb-board-name { font-size: 18px; font-weight: 700; letter-spacing: -0.01em; } /* board title */
.kb-me { width: 30px; height: 30px; border-radius: 50%;
  background: oklch(0.62 0.16 262); color: #fff;
  display: grid; place-items: center; font-size: 13px; font-weight: 600; }     /* current user */
.kb-invite { font-size: 13px; font-weight: 600; color: var(--ink);
  background: oklch(0.97 0.004 265); border: 1px solid var(--line);
  padding: 7px 14px; border-radius: 9px; }                                     /* "+ Invite" */
```

---

## 6. Icons
Inline SVG, `stroke="currentColor"`, no fill. Sized 13×13 inside the card.

**Calendar** (due date):
```html
<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor"
     stroke-width="2" stroke-linecap="round">
  <rect x="3" y="4.5" width="18" height="17" rx="3"/><path d="M3 9h18M8 2.5v4M16 2.5v4"/>
</svg>
```
(Option C does not use a check icon in the foot — the count text carries that. A check glyph is only
used by other variants.)

---

## 7. Data model
```ts
type AccentKey = 'rose' | 'amber' | 'blue' | 'violet' | 'teal' | 'green';

interface Assignee {
  i: string;        // single initial shown in the avatar (Thai or Latin)
  c: AccentKey;     // avatar background accent
}

interface Card {
  color: AccentKey;       // card accent (dot + label + progress fill)
  label: string;          // category, rendered UPPERCASE via CSS
  title: string;          // task name (Thai or Latin)
  due?: string;           // pre-formatted display string, e.g. "15 มิ.ย. 2569" — omit for no due date
  dueSoon?: boolean;      // true → red urgent styling
  checklist: [number, number];  // [done, total]
  assignees: Assignee[];
}

interface Column {
  key: string; name: string;
  tint: string; pill: string; pillText: string;  // see §5.1
  cards: Card[];
}
```

### Sample card (the >8 subtask case)
```js
{ color:'violet', label:'Migration', title:'ย้ายฐานข้อมูลขึ้น Production',
  due:'25 มิ.ย.', checklist:[7,18],
  assignees:[{i:'T',c:'blue'},{i:'ก',c:'violet'}] }
```
→ renders the **mini-bar** (18 > 8) at `width: 39%` in violet `solid`, with count `7/18`.

---

## 8. Implementation checklist
- [ ] Load IBM Plex Sans Thai + IBM Plex Sans (weights 400/500/600/700).
- [ ] Define ink tokens + `--card-shadow` + the 6 accent color sets.
- [ ] Card: top row (label+dot / avatars) → title → 1px rule → foot (due / progress).
- [ ] Progress: segments when `total ≤ 8`, mini-bar when `total > 8`; count always shown; green when complete.
- [ ] Due states: normal / `.soon` (red) / `.muted` ("ไม่มีกำหนด").
- [ ] Avatars overlap with white ring, `--sz: 24px` on cards.
- [ ] Column + top bar shell per §5.
- [ ] Verify Thai text renders without clipped descenders at the given line-heights.

---

*Reference implementation: `Kanban Card Redesign.html` (Option C artboard) in this project.*
