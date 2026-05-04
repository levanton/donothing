#!/usr/bin/env python3
"""
Poster-style App Store Screenshot Renderer.

Renders a parameterised HTML template to a pixel-perfect 1290×2796 PNG
using headless Google Chrome. No AI required.

Templates live in ./templates/ and use {{placeholder}} substitution.
"""

import argparse
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

# ── Canvas ──────────────────────────────────────────────────────────
CANVAS_W = 1290
CANVAS_H = 2796

# ── Default Chrome locations (macOS) ────────────────────────────────
CHROME_CANDIDATES = [
    os.environ.get("CHROME_PATH"),
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    shutil.which("google-chrome-stable"),
    shutil.which("chromium"),
    shutil.which("chrome"),
]


def find_chrome() -> str:
    for c in CHROME_CANDIDATES:
        if c and os.path.exists(c):
            return c
    sys.exit(
        "Chrome / Chromium not found. Install Google Chrome, or set "
        "CHROME_PATH environment variable to a Chromium-based browser binary."
    )


def load_illustration(path: str) -> str:
    """Read an SVG file and return its <svg>...</svg> content for inline use."""
    if not path:
        return ""
    p = Path(path)
    if not p.exists():
        sys.exit(f"Illustration file not found: {path}")
    raw = p.read_text(encoding="utf-8")
    # Strip XML prolog so SVG can be embedded inside HTML body
    if raw.lstrip().startswith("<?xml"):
        raw = raw.split("?>", 1)[1]
    return raw.strip()


def substitute(template: str, params: dict) -> str:
    out = template
    for key, value in params.items():
        out = out.replace("{{" + key + "}}", value if value is not None else "")
    return out


def render(template_path: Path, params: dict, output_path: Path) -> None:
    template = template_path.read_text(encoding="utf-8")
    html = substitute(template, params)

    chrome = find_chrome()

    # Chrome --headless=new reserves ~87px at the bottom of the viewport for
    # internal layout (even with --hide-scrollbars). Render at a taller window
    # so layout extends correctly, then crop to the exact App Store size.
    render_h = CANVAS_H + 200

    with tempfile.TemporaryDirectory() as tmpdir:
        tmp_html = Path(tmpdir) / "poster.html"
        tmp_html.write_text(html, encoding="utf-8")
        raw_png = Path(tmpdir) / "raw.png"
        url = tmp_html.resolve().as_uri()

        cmd = [
            chrome,
            "--headless=new",
            "--disable-gpu",
            "--hide-scrollbars",
            "--no-sandbox",
            "--default-background-color=00000000",
            "--virtual-time-budget=3000",
            f"--window-size={CANVAS_W},{render_h}",
            f"--screenshot={raw_png.resolve()}",
            url,
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
        if result.returncode != 0:
            sys.stderr.write(result.stdout)
            sys.stderr.write(result.stderr)
            sys.exit(f"Chrome render failed (exit {result.returncode})")

        if not raw_png.exists():
            sys.exit("Render finished but output file is missing.")

        from PIL import Image
        img = Image.open(raw_png)
        img.crop((0, 0, CANVAS_W, CANVAS_H)).save(output_path)

    print(f"✓ {output_path} ({CANVAS_W}×{CANVAS_H})")


def main():
    p = argparse.ArgumentParser(description="Render a poster-style App Store screenshot")
    p.add_argument("--template", required=True, help="Template name (e.g. poster-typography) or path to .html")
    p.add_argument("--verb", default="", help="Action verb headline (e.g. STOP)")
    p.add_argument("--desc", default="", help="Benefit descriptor headline (e.g. THE RUSH)")
    p.add_argument("--line3", default="", help="Optional third headline line (e.g. DO NOTHING)")
    p.add_argument("--subtitle", default="", help="Subtitle / secondary copy")
    p.add_argument("--bg", default="#C26749", help="Background hex colour")
    p.add_argument("--text-color", default="#FFFFFF", help="Headline text colour")
    p.add_argument("--accent-color", default="#F9F2E0", help="Subtitle / accent colour")
    p.add_argument("--headline-size", default="200", help="Headline font-size in px (default 200; pick 240 for short 1-line headlines, 160 for 12+ char headlines)")
    p.add_argument("--subtitle-size", default="56", help="Subtitle font-size in px (default 56)")
    p.add_argument("--align", default="left", choices=["left", "center"], help="Text alignment (default left)")
    p.add_argument("--ui-scale", default="0.95", help="Device frame scale, e.g. 0.95 (default). Use 1.0 to fill more, 0.85 to shrink (poster-device only)")
    p.add_argument("--ui-bleed", default="0", help="Pixels the device extends BELOW the canvas bottom (default 0 = sit flush; e.g. 600 for partial bleed) (poster-device only)")
    p.add_argument("--ui-top", default="720", help="Top offset where the device begins, in px (default 720) (poster-device only)")
    p.add_argument("--illustration", default="", help="Path to SVG illustration (illustration template only)")
    p.add_argument("--photo", default="", help="Path to background photo (photo template only)")
    p.add_argument("--output", required=True, help="Output PNG path")
    args = p.parse_args()

    skill_dir = Path(__file__).parent
    templates_dir = skill_dir / "templates"

    # Resolve template: name → templates/name.html, or treat as direct path
    tpl = Path(args.template)
    if not tpl.suffix:
        tpl = templates_dir / f"{args.template}.html"
    if not tpl.exists():
        sys.exit(f"Template not found: {tpl}")

    frame_path = skill_dir / "assets" / "device_frame.png"

    params = {
        "verb": args.verb.upper(),
        "desc": args.desc.upper(),
        "line3": args.line3.upper(),
        "subtitle": args.subtitle,
        "bg": args.bg,
        "text_color": args.text_color,
        "accent_color": args.accent_color,
        "headline_size": str(args.headline_size),
        "subtitle_size": str(args.subtitle_size),
        "align": args.align,
        "ui_scale": str(args.ui_scale),
        "ui_bleed": str(args.ui_bleed),
        "ui_top": str(args.ui_top),
        "frame_url": frame_path.resolve().as_uri() if frame_path.exists() else "",
        "illustration": load_illustration(args.illustration) if args.illustration else "",
        "photo": Path(args.photo).resolve().as_uri() if args.photo else "",
    }

    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    render(tpl, params, output)


if __name__ == "__main__":
    main()
