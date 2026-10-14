#!/usr/bin/env python3
"""Monta o site estático a partir de src/.

Cada página em src/pages/<slug>.html começa com um cabeçalho de metadados:

    <!--
    title: Título da página
    desc: Descrição para SEO
    nav: chave-do-menu
    -->

e o restante do arquivo é o conteúdo do <main>. A saída vai para
<slug>/index.html (ou index.html para a home), preservando as URLs do site antigo.

Marcadores disponíveis nas páginas e parciais:
    {{root}}        caminho relativo até a raiz do site ("" ou "../")
    {{icon:nome}}   ícone SVG inline (ver src/icons/)
    {{cta}}         faixa de chamada para orçamento
"""
import re
from pathlib import Path

ROOT = Path(__file__).parent
SRC = ROOT / "src"

NAV = [
    ("home", "Home", ""),
    ("estacas", "Estacas", "estacas/"),
    ("fundacao", "Fundação", "fundacao/"),
    ("central", "Central de Concreto", "central-de-concreto/"),
    ("qualidade", "Controle de Qualidade", "controle-de-qualidade/"),
    ("clientes", "Clientes", "clientes/"),
    ("faq", "FAQ", "perguntas-frequentes/"),
]


def read(path):
    return (SRC / path).read_text(encoding="utf-8")


def icons():
    return {p.stem: p.read_text(encoding="utf-8").strip() for p in (SRC / "icons").glob("*.svg")}


CLIENTES = [
    ("suzano", "Suzano Papel e Celulose"), ("votorantim", "Votorantim"), ("volkswagen", "Volkswagen"),
    ("gerdau", "Gerdau"), ("klabin", "Klabin"), ("shell", "Shell"), ("dupont", "DuPont"),
    ("coca-cola", "Coca-Cola"), ("itau", "Itaú"), ("rhodia", "Rhodia"), ("white-martins", "White Martins"),
    ("melhoramentos", "Melhoramentos"), ("yakult", "Yakult"), ("parmalat", "Parmalat"), ("brahma", "Brahma"),
    ("antarctica", "Antarctica"), ("kaiser", "Kaiser"), ("iff", "IFF"), ("fleischmann", "Fleischmann"),
    ("casas-bahia", "Casas Bahia"), ("dako", "Dako"), ("noroeste", "Noroeste"), ("bankboston", "BankBoston"),
    ("maua-plaza", "Mauá Plaza Shopping"), ("cliente", "Cliente IPR"),
]


def logo_tiles(items, root):
    return "".join(
        f'<div class="logo-tile"><img src="{root}assets/clientes/{slug}.png" alt="{name}" '
        f'width="182" height="160" loading="lazy"></div>'
        for slug, name in items
    )


def marquee(half, root):
    items = CLIENTES[:13] if half == "a" else CLIENTES[13:]
    tiles = logo_tiles(items, root)
    # a faixa é duplicada para o loop contínuo; a cópia fica oculta para leitores de tela
    return f'<div class="marquee__track">{tiles}<div style="display:contents" aria-hidden="true">{tiles}</div></div>'


def render(text, ctx, icon_map):
    text = text.replace("{{cta}}", read("partials/cta.html"))
    root = ctx["root"]
    text = re.sub(r'<div class="marquee" data-marquee="(a|b)"></div>',
                  lambda m: f'<div class="marquee">{marquee(m.group(1), root)}</div>', text)
    text = text.replace("{{logos}}", logo_tiles(CLIENTES, root))
    text = re.sub(r"\{\{icon:([\w-]+)\}\}", lambda m: icon_map[m.group(1)], text)
    text = re.sub(r"\{\{svg:([\w-]+)\}\}", lambda m: read(f"illustrations/{m.group(1)}.svg"), text)
    for key, value in ctx.items():
        text = text.replace("{{" + key + "}}", value)
    return text


def nav_html(active, root):
    items = []
    for key, label, href in NAV:
        cls = ' class="is-active" aria-current="page"' if key == active else ""
        items.append(f'<li><a href="{root}{href}"{cls}>{label}</a></li>')
    return "\n".join(items)


def build():
    icon_map = icons()
    layout = read("partials/layout.html")
    for page in sorted((SRC / "pages").glob("*.html")):
        raw = page.read_text(encoding="utf-8")
        meta_block, body = re.match(r"\s*<!--(.*?)-->(.*)", raw, re.S).groups()
        meta = dict(
            (k.strip(), v.strip())
            for k, v in (line.split(":", 1) for line in meta_block.strip().splitlines())
        )
        slug = page.stem
        out = ROOT / ("index.html" if slug == "index" else f"{slug}/index.html")
        root = "" if slug == "index" else "../"
        ctx = {
            "root": root,
            "title": meta["title"],
            "desc": meta["desc"],
            "page": slug,
            "nav": nav_html(meta.get("nav", ""), root),
        }
        html = layout.replace("{{content}}", body.strip())
        html = render(render(html, ctx, icon_map), ctx, icon_map)
        # renders da maquete: serve WebP com versão de 900 px para telas pequenas
        html = re.sub(r'src="((?:\.\./)?)assets/img/3d/([\w-]+)\.jpg"',
                      lambda m: f'src="{m[1]}assets/img/3d/{m[2]}.webp" '
                                f'srcset="{m[1]}assets/img/3d/{m[2]}-900.webp 900w, {m[1]}assets/img/3d/{m[2]}.webp 1600w"', html)
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(html, encoding="utf-8")
        print("ok", out.relative_to(ROOT))


if __name__ == "__main__":
    build()
