# The Atatürk — Style Guide

> **Mood:** BBC Sport circa 2005, ported into a wider viewport. Off-white ivory paper, navy ink, muted broadcast red. Sober, archival, restrained. The match-report-the-next-morning feel — never the SaaS dashboard feel.

---

## 1. Color tokens

```css
:root {
  /* Paper */
  --ivory:      #f4ede1;  /* page bg */
  --ivory-2:    #ece2cf;  /* secondary bg / strips */
  --panel:      #fbf8f1;  /* card/panel surface */

  /* Ink */
  --navy:       #142036;  /* primary text + rules + slate bars */
  --navy-soft:  #2c3a52;  /* secondary headings */
  --navy-mute:  #5a6781;  /* tertiary copy, captions, italic body */

  /* Brand reds — Liverpool / broadcast */
  --red:        #9c2118;  /* primary accent, CTAs, live dots */
  --red-deep:   #7a1812;  /* CTA borders / shadow */
  --claret:     #5a1a1f;  /* secondary red accent */

  /* Supporting */
  --ochre:      #a87a2a;  /* sparingly — second commentator, B-roll highlights */
  --green:      #2f4a32;  /* pitch */
  --green-li:   #3e5d3f;  /* pitch — lighter stripe */
  --rule:       var(--navy);
  --rule-faint: #c8bea5;  /* hairline dividers on ivory */
}
```

**Rules of thumb**
- 80% of any page is ivory + navy. Red is an accent only — score-bug, CTAs, live indicators, single-letter highlights, scout-note kickers, hover/focus states.
- Never gradients in the body content. The only allowed gradient is the very subtle radial background corners (see §6).
- No traffic-light palettes. If you need a 5-step ramp (e.g. ratings tiers), use a single-hue navy→red value scale, not green/yellow/orange/red.

---

## 2. Typography

```css
--serif: "Source Serif 4", Georgia, serif;       /* body, italics, scout notes */
--slab:  "Roboto Slab", Rockwell, Georgia, serif;/* headings, kickers, buttons, labels */
--mono:  "JetBrains Mono", "Courier New", monospace; /* numbers, timestamps, stats, tickers */
```

Load all three:

```html
<link href="https://fonts.googleapis.com/css2?family=Roboto+Slab:wght@400;500;600;700;800&family=Source+Serif+4:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
```

**Type stack**

| Role | Font | Size | Weight | Tracking | Case |
|---|---|---|---|---|---|
| Page title | slab | 28–34 | 800 | -0.6 | sentence |
| Section heading | slab | 18–22 | 700 | -0.3 | sentence |
| Kicker / eyebrow | slab | 9–10 | 700 | 2.0–2.5 | UPPER |
| Slate bar (broadcast) | slab | 14–16 | 700–800 | 0.5–1.5 | UPPER (sometimes) |
| Body | serif | 13–14 | 400 | normal | sentence |
| Italic body / scout note | serif italic | 12–13 | 400 | normal | sentence |
| Caption | serif italic | 11–12 | 400 | normal | sentence |
| Stat number | mono | 13–36 | 700 | -0.5 to -1 | n/a |
| Ticker / metadata | mono | 10–11 | 400 | 1.0–1.4 | UPPER |
| Button label | slab | 11–13 | 700 | 1.4–1.5 | UPPER |
| Form label | slab | 10–11 | 700 | 1.2–2.0 | UPPER |

**Use italics liberally** for caption-y or quote-y secondary copy. They do a lot of the heavy lifting that SaaS designs would normally hand to a muted gray.

---

## 3. Surfaces & rules

- Page bg: `--ivory`
- Card / panel surface: `--panel` (slightly warmer than ivory)
- Secondary strip / table-header bg: `--ivory-2`
- Hairline rule between rows / sections: `1px solid var(--rule-faint)` on ivory; `1px solid var(--navy)` for major dividers (slate-to-content, column borders)
- **No rounded corners.** Square it all. The one allowed exception is `border-radius: 1–2px` on the score-bug or other broadcast-y inset blocks. Never above 4px.
- **No shadows on UI elements.** A single `box-shadow: 0 1px 0 rgba(0,0,0,0.04)` is fine for cards; modals use `0 30px 80px rgba(0,0,0,0.5)`. Don't stack soft drop-shadows.
- Cards get a left border accent in the team color (`4px solid var(--red)` for Liverpool, `4px solid var(--navy)` for Milan). That's how affiliation reads at a glance.

---

## 4. Components

### 4.1 Masthead (use on every page)

Two strips stacked, total 36px tall, navy 1px bottom rule:

```jsx
<div style={{ display:'flex', height:36, borderBottom:'1px solid var(--navy)' }}>
  <div style={{ background:'var(--navy)', color:'var(--ivory)', padding:'0 22px',
                display:'flex', alignItems:'center', fontFamily:'var(--slab)',
                fontWeight:700, fontSize:14, letterSpacing:0.4 }}>
    The Atatürk
    <span style={{ fontFamily:'var(--serif)', fontStyle:'italic', fontWeight:400,
                   fontSize:11, marginLeft:10, opacity:0.75 }}>· Six Crazy Minutes</span>
  </div>
  <div style={{ flex:1, background:'var(--ivory-2)', padding:'0 22px',
                display:'flex', alignItems:'center', justifyContent:'space-between',
                fontFamily:'var(--mono)', fontSize:11, letterSpacing:1,
                textTransform:'uppercase', color:'var(--navy-soft)' }}>
    <span>{leftKicker}</span>
    <span style={{ fontFamily:'var(--slab)', color:'var(--red)', fontWeight:700 }}>{title}</span>
    <span>{rightKicker}</span>
  </div>
</div>
```

### 4.2 Footer ticker

```jsx
<div style={{ background:'var(--navy)', color:'var(--ivory)', padding:'8px 22px',
              display:'flex', justifyContent:'space-between',
              fontFamily:'var(--mono)', fontSize:10, letterSpacing:1, textTransform:'uppercase' }}>
  <span>SCM /// Vol I — § scouting /// page name</span>
  <span style={{ opacity:0.6 }}>{contextual metadata}</span>
</div>
```

### 4.3 Buttons

Primary CTA — slab caps, red on red-deep border, inset bottom shadow:

```css
.btn-primary {
  font-family: var(--slab); font-weight: 700; font-size: 13;
  letter-spacing: 1.5px; text-transform: uppercase;
  padding: 13px 22px;
  background: var(--red); color: var(--ivory);
  border: 1px solid var(--red-deep);
  box-shadow: inset 0 -2px 0 rgba(0,0,0,0.2);
  cursor: pointer;
}
```

Secondary — same shape, navy outline:

```css
.btn-secondary {
  font-family: var(--slab); font-weight: 700; font-size: 13;
  letter-spacing: 1.5px; text-transform: uppercase;
  padding: 13px 22px;
  background: var(--panel); color: var(--navy);
  border: 1px solid var(--navy);
}
```

Use `▸` (U+25B8) as the action arrow, never `→`. Place trailing.

### 4.4 Input

```css
.input {
  font-family: var(--serif); font-size: 13; color: var(--navy);
  background: transparent;
  border: 1px solid var(--navy-soft);
  padding: 10px 14px;
  outline: none;
}
.input:focus { box-shadow: 0 0 0 1.5px rgba(156,33,24,0.5); }
.input::placeholder { color: var(--navy-mute); font-style: italic; }
```

### 4.5 Slider (range)

Navy track, red ivory-ringed thumb. Don't use a default browser slider:

```css
.range { -webkit-appearance: none; appearance: none; height: 16px; background: transparent; }
.range::-webkit-slider-runnable-track { height: 4px; background: var(--navy); border-radius: 2px; }
.range::-webkit-slider-thumb {
  -webkit-appearance: none; width: 16px; height: 16px;
  background: var(--red); border: 2px solid var(--ivory); border-radius: 50%;
  margin-top: -6px; box-shadow: 0 1px 3px rgba(0,0,0,0.3); cursor: grab;
}
/* repeat for ::-moz-range-track / ::-moz-range-thumb */
```

### 4.6 Score-bug / lower-third

The signature element. Used for live state, modal headers, dialog slates.

```jsx
<div style={{ display:'flex', height:64, borderBottom:'1px solid var(--navy)' }}>
  <div style={{ width:60, background:'var(--red)', color:'var(--ivory)',
                display:'flex', alignItems:'center', justifyContent:'center',
                fontFamily:'var(--slab)', fontWeight:800, fontSize:14 }}>LFC</div>
  <div style={{ flex:1, background:'var(--navy)', color:'var(--ivory)',
                display:'grid', gridTemplateColumns:'1fr auto 1fr', alignItems:'center',
                padding:'0 26px' }}>
    {/* left team / score / clock / right team */}
  </div>
  <div style={{ width:60, background:'repeating-linear-gradient(90deg, #0e0c0a 0 9px, #7a1418 9px 17px)' }} />
</div>
```

Milan stripes: `repeating-linear-gradient(90deg, #0e0c0a 0 9px, #7a1418 9px 17px)`.
Liverpool block: solid `var(--red)`.

### 4.7 Card

```css
.card {
  background: var(--panel);
  border: 1px solid var(--rule-faint);
  border-left: 4px solid var(--red);   /* or var(--navy) for Milan */
  box-shadow: 0 1px 0 rgba(0,0,0,0.04);
}
.card[selected] {
  border-color: var(--red);
  box-shadow: 0 0 0 2px rgba(156,33,24,0.2), 0 1px 0 rgba(0,0,0,0.04);
}
```

Internal layout: top strip with metadata + a kicker, divider, body, divider, italic scout-note footer with a slab kicker prefix.

### 4.8 Tier / status chips

Slab caps, square corners, ivory text on a colored block. Two variants:
- **Solid:** `background: <semantic color>; color: var(--ivory)`
- **Outline:** `background: var(--ivory); border: 1px solid var(--navy-soft); color: var(--navy)`

For tiered scales, use the navy→red ramp:

```
S → #142036 (navy)
A → #2c3a52 (navy-soft)
B → #5a6781 (navy-mute)
C → #8a8273 (warm gray)
D → #a89e8a (faded)
```

### 4.9 Modal

Backdrop: `rgba(20,32,54,0.78)`. Surface: `--ivory`, `1px solid var(--navy)`, `box-shadow: 0 30px 80px rgba(0,0,0,0.5)`. Header is always a score-bug-style slate (red label block + navy bar + close button). Esc closes.

### 4.10 Compare / utility lower-third

A docked navy strip, 4px red top border, ivory chip-label on the left, slab + serif italic content, slab CTAs on the right. Same vocabulary as the score-bug.

### 4.11 Stat / data bars

```jsx
<div style={{ height:5, background:'var(--ivory-2)', border:'1px solid var(--rule-faint)' }}>
  <div style={{ height:'100%', width:`${value}%`, background:'var(--red)' }} />
</div>
```

Pair every bar with a mono numeric on the right and a slab caps label on the left. Never label-only.

### 4.12 Section eyebrow + heading pair

```jsx
<div>
  <div style={{ fontFamily:'var(--slab)', fontSize:10, letterSpacing:2.5,
                textTransform:'uppercase', color:'var(--red)', marginBottom:4 }}>
    Section · sub-area
  </div>
  <div style={{ fontFamily:'var(--slab)', fontWeight:700, fontSize:22,
                color:'var(--navy)', letterSpacing:-0.3 }}>
    Section title
  </div>
</div>
```

Use the `·` (middle dot) as the universal kicker separator.

---

## 5. Layout & spacing

- Standard page width target: **1280px** for fixed layouts; otherwise responsive with 22–28px gutters.
- Page padding: `20–28px` horizontal.
- Card internal padding: `12–14px`.
- Vertical rhythm: `4 / 6 / 10 / 14 / 18 / 22 / 28` — pick from this scale, don't invent.
- Two- and three-column layouts use a `1px solid var(--navy)` between columns. Inside a column, rows separate with `1px solid var(--rule-faint)`.

---

## 6. Page background

Subtle radial corners on ivory:

```css
body {
  background:
    radial-gradient(circle at 12% 6%, rgba(0,0,0,0.025) 0, transparent 40%),
    radial-gradient(circle at 88% 96%, rgba(0,0,0,0.03) 0, transparent 42%),
    var(--ivory);
}
```

---

## 7. Iconography & glyphs

- **Avoid icons.** Use type, color blocks, and rules instead.
- When you need a marker, use these glyphs in slab or mono:
  - `▸` action arrow (after CTA labels)
  - `·` separator (kickers, metadata)
  - `—` em-dash (between teams in a slate, e.g. "Liverpool — Milan")
  - `★` rare emphasis (live indicator, footer ticker)
  - `(C)` for captain — small slab, red, in parentheses
- Live state indicator: a 7×7px red dot with `animation: pulse 1.4s infinite` where `pulse { 50% { opacity: 0.25 } }`.

---

## 8. Copy voice

- **Match-report-the-next-morning, not product-marketing.** Sober, factual, occasionally lyrical.
- Use second-person sparingly. Prefer past-tense or bare-noun-phrase headings ("All square at the break", not "You are tied").
- Italics for asides, quotes, and color commentary. Slab caps for institutional voice (kickers, labels, slates).
- Numbers in mono. Always.
- It's "Atatürk" with an umlaut, "BBC", "Liverpool", "AC Milan". `0–3` uses an en-dash, not a hyphen.

---

## 9. Don't list

- ❌ Rounded corners > 4px
- ❌ Drop-shadows on cards or buttons (other than the inset CTA shadow + 1px-card-lift)
- ❌ Bright/saturated semantic colors (bright green ✅ → use navy or red value-step)
- ❌ Emoji
- ❌ Gradients in content (only the global page-corner radials)
- ❌ Generic system fonts (no Inter, Roboto sans, Arial)
- ❌ Sentence-case button labels (always UPPER, slab, tracked)
- ❌ Default browser sliders / selects (style every form control)
- ❌ Sans-serif body copy
- ❌ Title screens / hero sections that don't earn their height
- ❌ Single-color filled radar charts in bright tier colors

---

## 10. Reference files

- `Player Ratings.html` — canonical example of the system applied to a data-heavy page (cards, columns, search/filter, modal compare, lower-third).
- `The Ataturk.html` — canonical example applied to interactive screens (pre-match, live, half-time).
- `direction-2-bbc.jsx` — D2 component primitives (`D2Header`, `D2Btn`, `D2Slider`, `D2Pitch`, `D2RowL`).
- `player-ratings.jsx` — radar drawing, card, modal, compare bar.

When in doubt, open one of those files and copy the pattern. Don't reinvent.
