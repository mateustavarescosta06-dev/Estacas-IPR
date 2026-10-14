#!/usr/bin/env python3
"""Converte os renders de assets/img/3d/*.jpg em WebP (1600 px e 900 px) e gera og.jpg.
Os JPGs de origem são apagados depois (regere com tools/render.js se precisar)."""
from pathlib import Path
from PIL import Image

DIR = Path(__file__).resolve().parent.parent / "assets" / "img" / "3d"
for jpg in sorted(DIR.glob("*.jpg")):
    if jpg.name == "og.jpg":
        continue
    im = Image.open(jpg).convert("RGB")
    for w, name, q in ((1600, f"{jpg.stem}.webp", 74), (900, f"{jpg.stem}-900.webp", 72)):
        out = im.copy(); out.thumbnail((w, w), Image.LANCZOS)
        out.save(DIR / name, "WEBP", quality=q, method=6)
    if jpg.stem == "hero-blueprint":  # imagem de compartilhamento (redes sociais)
        og = im.copy(); og.thumbnail((1200, 1200), Image.LANCZOS)
        top = (og.height - 630) // 2
        og.crop((0, top, 1200, top + 630)).save(DIR / "og.jpg", "JPEG", quality=80, optimize=True)
    jpg.unlink()
    print("ok", jpg.stem)
