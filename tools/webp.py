#!/usr/bin/env python3
"""Converte os renders de assets/img/3d/*.jpg em WebP (tamanho cheio e 900 px)."""
from pathlib import Path
from PIL import Image

DIR = Path(__file__).resolve().parent.parent / "assets" / "img" / "3d"
for jpg in sorted(DIR.glob("*.jpg")):
    im = Image.open(jpg).convert("RGB")
    im.save(jpg.with_suffix(".webp"), "WEBP", quality=82, method=6)
    small = im.copy()
    small.thumbnail((900, 900 * im.height // im.width), Image.LANCZOS)
    small.save(DIR / f"{jpg.stem}-900.webp", "WEBP", quality=80, method=6)
    print("ok", jpg.name, "->", jpg.stem + ".webp", jpg.stem + "-900.webp")
