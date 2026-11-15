"""Resolve Japanese sign fonts without changing the macOS Hiragino artwork.

On Linux, fontconfig chooses installed Japanese faces. The directory override is
useful on other hosts and for reproducing the original Hiragino textures.
"""
import os
import subprocess
import sys

# Fontconfig's weight values, from thin through black, for Hiragino's W0-W9.
GOTHIC_WEIGHTS = (0, 40, 50, 75, 80, 100, 180, 200, 205, 210)


def fontconfig_font(family, weight):
    try:
        match = subprocess.run(
            ["fc-match", "-f", "%{file}\n%{lang}\n", f"{family}:lang=ja:weight={weight}"],
            capture_output=True, text=True, check=True,
        )
    except (OSError, subprocess.CalledProcessError):
        return None
    lines = match.stdout.splitlines()
    # fc-match can silently return a Latin font when no Japanese face exists.
    if len(lines) < 2 or "ja" not in lines[1].split("|"):
        return None
    return lines[0] if os.path.isfile(lines[0]) else None


def resolve_fonts():
    directory = os.environ.get("THREERT_FONT_DIR")
    if directory is None and sys.platform == "darwin":
        directory = "/System/Library/Fonts"

    def choose(name, family, weight):
        local = os.path.join(directory, name) if directory else None
        if local and os.path.isfile(local):
            return local
        found = fontconfig_font(family, weight)
        if found:
            return found
        raise RuntimeError(
            f"gen_signs.py: no Japanese font found for {name!r}. "
            f"Checked {local or 'the platform font directory'} and fontconfig. "
            "Install Japanese fonts (e.g. fonts-noto-cjk on Debian/Ubuntu), "
            "or set THREERT_FONT_DIR to a directory containing Hiragino fonts."
        )

    gothic = {
        w: choose(f"ヒラギノ角ゴシック W{w}.ttc", "sans-serif", weight)
        for w, weight in enumerate(GOTHIC_WEIGHTS)
    }
    mincho = choose("ヒラギノ明朝 ProN.ttc", "serif", 80)
    maru = choose("ヒラギノ丸ゴ ProN W4.ttc", "sans-serif", 80)
    return gothic, mincho, maru
