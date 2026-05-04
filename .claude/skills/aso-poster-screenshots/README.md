# aso-poster-screenshots

Generate poster-style App Store screenshots — bold typography over a flat brand colour, optional hand-drawn illustration, **no iPhone frame**. Best for wellness / meditation / lifestyle apps in the Calm / Headway / Endel / Insight Timer category, where the feeling matters more than the feature.

Sister skill: [`aso-appstore-screenshots`](../aso-appstore-screenshots) — use that one when the app is utility / tooling / finance and showing the UI is the strongest selling point.

## What it makes

- Pixel-perfect 1290 × 2796 PNGs (iPhone 6.7" — Apple auto-scales to other slots)
- Three template variants: `poster-typography`, `poster-illustration`, `poster-photo`
- One solid brand colour; bold left-aligned headline; optional subtitle; optional SVG / photo

## How it renders

`render.py` parameterises a chosen HTML template and pipes it through headless Google Chrome to produce a PNG at exact App Store dimensions. **No AI, no pip dependencies, no Gemini / Nano Banana costs.**

## Requirements

- macOS with Google Chrome installed at the standard path (or set `CHROME_PATH` env var)
- Python 3.x (no extra packages — uses only stdlib)

## Quick smoke test

```bash
python3 ~/.claude/skills/aso-poster-screenshots/render.py \
  --template poster-typography \
  --verb "STOP" --desc "THE RUSH." --line3 "DO NOTHING." \
  --subtitle "Even one minute changes everything." \
  --bg "#C26749" \
  --output /tmp/test.png
```

Expected: `/tmp/test.png` is a valid 1290 × 2796 image with the headline and subtitle on a terracotta background.

## Layout

```
aso-poster-screenshots/
├── SKILL.md                     ← invoked by /aso-poster-screenshots
├── README.md                    ← this file
├── render.py                    ← HTML → PNG via headless Chrome
├── showcase.py                  ← optional side-by-side preview
├── templates/
│   ├── poster-typography.html
│   ├── poster-illustration.html
│   └── poster-photo.html
└── assets/
    ├── illustrations/           ← bring your own SVGs here
    └── fonts/                   ← optional custom fonts
```

## Future: AI texture pass

The render is intentionally clean. A future `--texture-pass` flag will pipe the rendered PNG through an image model (Nano Banana Pro via Gemini MCP) to add risograph grain / paper texture / subtle imperfection — without changing typography or layout. **Not implemented yet** — see SKILL.md "Optional: AI Texture Pass" section.
