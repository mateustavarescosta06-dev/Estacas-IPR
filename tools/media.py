#!/usr/bin/env python3
"""Prepara as imagens e clipes do site a partir de media/src.

Cada cena declarada em media/slots.json aponta para um arquivo de origem em media/src
(foto real da fábrica ou geração do Higgsfield). O script aplica a gradação da casa,
gera AVIF e WebP em até três larguras em assets/media e grava assets/media/manifest.json,
que o build.py usa para montar os <picture>.

Se existir media/src/<cena>.mp4, ele vira clipe de rolagem: H.264 com quadro-chave a cada
2 quadros (busca rápida ao rolar), sem áudio, versão de 1080 px e de 720 px, e um pôster.

    python tools/media.py            # processa só o que mudou
    python tools/media.py --force    # refaz tudo
"""
import json
import shutil
import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "media" / "src"
OUT = ROOT / "assets" / "media"
SLOTS = json.loads((ROOT / "media" / "slots.json").read_text(encoding="utf-8"))
FORCE = "--force" in sys.argv
WIDTHS = (640, 1080, 1600)
LUMA = np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)

# Gradações: uma série, não fotos soltas. Céu azul saturado vira céu de obra,
# pretos levemente erguidos (fosco), altas luzes quentes como luz de fim de tarde no concreto.
LOOKS = {
    "dia": dict(exp=1.0, sat=.8, sky=.3, contrast=.18, black=.035, white=.975,
                shadow=(0, .004, .012), high=(.018, .008, -.012)),
    "aco": dict(exp=.97, sat=.7, sky=.4, contrast=.28, black=.03, white=.965,
                shadow=(-.004, .004, .016), high=(.004, .006, .008)),
    "crepusculo": dict(exp=.72, sat=.7, sky=.45, contrast=.3, black=.03, white=.93,
                       shadow=(0, .006, .022), high=(.055, .024, -.028)),
}


def grade(im, look):
    if look == "original":  # geração do Higgsfield já feita no visual da série: só converte
        return im.convert("RGB")
    p = LOOKS[look]
    a = np.asarray(im.convert("RGB"), dtype=np.float32) / 255.0 * p["exp"]
    y = a @ LUMA
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    sky = np.clip((b - np.maximum(r, g)) * 4.0, 0, 1)
    sat = p["sat"] * (1 - sky) + p["sky"] * sky
    a = y[..., None] + (a - y[..., None]) * sat[..., None]
    a = np.clip(a, 0, 1)
    a = a + (a * a * (3 - 2 * a) - a) * p["contrast"]
    a = p["black"] + a * (p["white"] - p["black"])
    y = a @ LUMA
    a = a + (1 - y)[..., None] * np.array(p["shadow"], np.float32) + y[..., None] * np.array(p["high"], np.float32)
    return Image.fromarray((np.clip(a, 0, 1) * 255 + .5).astype(np.uint8))


def tone(im):
    """Cor média da cena: fundo de espera enquanto a imagem carrega."""
    r, g, b = im.convert("RGB").resize((1, 1), Image.Resampling.BOX).getpixel((0, 0))
    return f"#{r:02x}{g:02x}{b:02x}"


def stale(src, outs):
    if FORCE or not all(o.exists() for o in outs):
        return True
    t = max(src.stat().st_mtime, (ROOT / "media" / "slots.json").stat().st_mtime, Path(__file__).stat().st_mtime)
    return any(o.stat().st_mtime < t for o in outs)


def images(name, slot, entry):
    src = SRC / slot["src"]
    im = ImageOps.exif_transpose(Image.open(src))
    w, h = im.size
    widths = sorted({min(x, w) for x in WIDTHS})
    outs = [OUT / f"{name}-{x}.{ext}" for x in widths for ext in ("avif", "webp")]
    graded = None
    if stale(src, outs):
        graded = grade(im, slot.get("grade", "dia"))
        if im.mode in ("RGBA", "LA") or "transparency" in im.info:
            # recorte para camada de profundidade: gradua a cor e devolve o alfa original
            graded.putalpha(im.convert("RGBA").getchannel("A"))
        for x in widths:
            small = graded if x == w else graded.resize((x, round(h * x / w)), Image.Resampling.LANCZOS)
            small.save(OUT / f"{name}-{x}.webp", quality=80, method=6, alpha_quality=100)
            small.save(OUT / f"{name}-{x}.avif", quality=58, speed=4)
        print("img", name, widths)
    graded = graded or Image.open(OUT / f"{name}-{widths[0]}.webp")
    entry.update(w=w, h=h, widths=widths, tone=tone(graded))


def ffmpeg(*args):
    exe = shutil.which("ffmpeg")
    if not exe:
        raise SystemExit("ffmpeg não encontrado no PATH (necessário para os clipes).")
    subprocess.run([exe, "-y", "-loglevel", "error", *args], check=True)


def video(name, entry):
    src = SRC / f"{name}.mp4"
    if not src.exists():
        return
    big, small, poster = OUT / f"{name}.mp4", OUT / f"{name}-m.mp4", OUT / f"{name}-poster.webp"
    if stale(src, [big, small, poster]):
        common = ["-an", "-c:v", "libx264", "-preset", "slow", "-pix_fmt", "yuv420p",
                  "-g", "2", "-keyint_min", "2", "-sc_threshold", "0", "-movflags", "+faststart"]
        ffmpeg("-i", str(src), "-vf", "scale='min(1080,iw)':-2", "-crf", "27", *common, str(big))
        ffmpeg("-i", str(src), "-vf", "scale='min(720,iw)':-2", "-crf", "29", *common, str(small))
        ffmpeg("-i", str(src), "-frames:v", "1", "-vf", "scale='min(1600,iw)':-2", str(poster))
        print("vid", name)
    entry["video"] = True


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    manifest = {}
    for name, slot in SLOTS.items():
        if name.startswith("_"):
            continue
        if not (SRC / slot["src"]).exists():
            print("aguardando", name, "->", slot["src"])  # cena declarada, arquivo ainda não gerado
            continue
        entry = {"pos": slot.get("pos", "50% 50%"), "alt": slot.get("alt", "")}
        images(name, slot, entry)
        video(name, entry)
        manifest[name] = entry
    (OUT / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=1), encoding="utf-8")
    print("ok", len(manifest), "cenas")


if __name__ == "__main__":
    main()
