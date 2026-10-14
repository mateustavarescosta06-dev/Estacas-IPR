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
# --verify gera uma cópia com marcações do verificador scroll-craft (data-sc-act / data-sc-copy)
import sys
VERIFY = "--verify" in sys.argv
OUT = ROOT / "scrollcraft" / "builds" / "ipr-rota" / "site" if VERIFY else ROOT
SRC = ROOT / "src"

# A rota de cravação: a ordem das páginas é a descida da estaca pelas camadas do solo.
# (slug da página, chave do menu, rótulo, caminho, profundidade em m, camada, chamada da passagem, rascunho)
ROUTE = [
    ("index", "home", "Home", "", 0.0, "Superfície do pátio",
     "Onde a obra começa: o pátio, a fábrica e a cravação.", "hero-blueprint"),
    ("central-de-concreto", "central", "Central de Concreto", "central-de-concreto/", 2.5, "Aterro",
     "Antes da forma vem a matéria: o concreto dosado, misturado e registrado.", "central-blueprint"),
    ("estacas", "estacas", "Estacas", "estacas/", 5.0, "Argila mole",
     "Três geometrias, onze seções e o catálogo com os ábacos de cada uma.", "estacas-blueprint"),
    ("controle-de-qualidade", "qualidade", "Controle de Qualidade", "controle-de-qualidade/", 7.5, "Silte argiloso",
     "Cada lote ensaiado em 24 horas, 3, 7 e 28 dias. Cada peça inspecionada.", "pilha-blueprint"),
    ("fundacao", "fundacao", "Fundação", "fundacao/", 10.0, "Areia fina, emenda a 10 m",
     "Na obra, a estaca é cravada, emendada e verificada golpe a golpe.", "fundacao-blueprint"),
    ("clientes", "clientes", "Clientes", "clientes/", 12.5, "Areia compacta",
     "Indústria, varejo e infraestrutura que já estão sobre estacas IPR.", "aerea-blueprint"),
    ("perguntas-frequentes", "faq", "Perguntas Frequentes", "perguntas-frequentes/", 15.0, "Areia muito compacta",
     "As dúvidas mais comuns sobre nega, emendas, solo e transporte.", "cravacao-blueprint"),
    ("contato", "contato", "Contato", "contato/", 17.6, "Camada resistente, nega atingida",
     "A estaca chegou à camada resistente. A próxima etapa é a sua obra.", "hero-blueprint"),
]
MAX_DEPTH = ROUTE[-1][4]
NAV = [(key, label, href) for _, key, label, href, *_ in ROUTE if key != "contato"]


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


def m(depth):
    return f"{depth:.1f}".replace(".", ",") + " m"


def route_index(slug):
    return next(i for i, r in enumerate(ROUTE) if r[0] == slug)


def station_html(slug):
    _, _, label, _, depth, layer, *_ = ROUTE[route_index(slug)]
    return (f'<p class="station"><span class="station__d">{m(depth)}</span>'
            f'<span class="station__l">{layer}</span></p>')


def route_html(slug, root):
    i = route_index(slug)
    items = []
    for j, (_, _, label, href, depth, layer, *_rest) in enumerate(ROUTE):
        state = "is-here" if j == i else ("is-past" if j < i else "is-ahead")
        cur = ' aria-current="page"' if j == i else ""
        top = depth / MAX_DEPTH * 100
        items.append(
            f'<li class="{state}" style="--at:{top:.2f}%"><a href="{root}{href}"{cur}>'
            f'<span class="route__dot" aria-hidden="true"></span>'
            f'<span class="route__txt"><b>{label}</b><small>{m(depth)} · {layer}</small></span></a></li>')
    nxt = ROUTE[i + 1][4] if i + 1 < len(ROUTE) else MAX_DEPTH
    return (f'<nav class="route" aria-label="Rota do site: a estaca desce pelas camadas do solo" data-route '
            f'data-from="{ROUTE[i][4]}" data-to="{nxt}" data-max="{MAX_DEPTH}" data-step="{i}">'
            f'<div class="route__rule" aria-hidden="true"><span class="route__pile" data-route-pile></span></div>'
            f'<ol>{"".join(items)}</ol>'
            f'<span class="route__read" aria-hidden="true" data-route-read>{m(ROUTE[i][4])}</span></nav>')


def handoff_html(slug, root):
    i = route_index(slug)
    if i + 1 >= len(ROUTE):
        # fim da rota: a estaca atinge a nega e o fecho resolve
        stamps = "".join(f'<li><span>{m(r[4])}</span>{r[2]}</li>' for r in ROUTE)
        return (f'<section class="handoff handoff--end" data-grid-area aria-label="Fim da rota">'
                f'<div class="grid-layer" data-grid="48" data-grid-label="NEGA"></div>'
                f'<div class="wrap handoff__inner"><div class="handoff__copy">'
                f'<p class="station"><span class="station__d">{m(MAX_DEPTH)}</span><span class="station__l">Nega atingida</span></p>'
                f'<h2 class="h-lg">A estaca chegou à camada resistente.</h2>'
                f'<p class="lead">Você percorreu a rota inteira, da superfície do pátio à nega. A próxima etapa é a sua obra.</p>'
                f'<a class="btn btn--ghost" href="{root}">Voltar à superfície {{{{icon:arrow}}}}</a></div>'
                f'<ol class="handoff__log" aria-label="Camadas percorridas">{stamps}</ol></div></section>')
    _, _, label, href, depth, layer, teaser, sketch = ROUTE[i + 1]
    return (f'<section class="handoff" data-grid-area aria-label="Próxima camada: {label}">'
            f'<div class="handoff__media" aria-hidden="true"><img src="{root}assets/img/3d/{sketch}.jpg" alt="" loading="lazy"></div>'
            f'<div class="grid-layer" data-grid="48" data-grid-label="{m(depth)}"></div>'
            f'<a class="wrap handoff__inner handoff__link" href="{root}{href}">'
            f'<span class="handoff__copy">'
            f'<span class="station"><span class="station__d">{m(depth)}</span><span class="station__l">{layer}</span></span>'
            f'<span class="handoff__title">{label}</span>'
            f'<span class="handoff__teaser">{teaser}</span></span>'
            f'<span class="handoff__go">Descer para a próxima camada {{{{icon:arrow}}}}</span></a></section>')


def nav_html(active, root):
    items = []
    for key, label, href in NAV:
        cls = ' class="is-active" aria-current="page"' if key == active else ""
        items.append(f'<li><a href="{root}{href}"{cls}>{label}</a></li>')
    return "\n".join(items)


def mark_for_verify(html):
    """Marca seções como atos e blocos de texto como cópia, só para o verificador."""
    html = re.sub(r'<section class="([^"]*\bdrive\b[^"]*)"', r'<section data-sc-act="pin" class="\1"', html)
    html = re.sub(r'<section(?! data-sc-act)( [^>]*)?>', lambda m: f'<section data-sc-act="flow"{m.group(1) or ""}>', html)
    # cada título e parágrafo é medido sozinho: um bloco inteiro mistura botões e fundos
    main = html.split("<main", 1)
    if len(main) == 2:
        main[1] = re.sub(r"<(h1|h2|h3|p)(?=[\s>])", r"<\1 data-sc-copy", main[1])
        html = "<main".join(main)
    # o verificador espera o sinal de pronto do motor scroll-craft; este site não usa o motor
    html = html.replace("</body>", '<script>document.addEventListener("DOMContentLoaded",function(){document.documentElement.classList.add("sc-ready")})</script></body>')
    return html


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
        out = OUT / ("index.html" if slug == "index" else f"{slug}/index.html")
        root = "" if slug == "index" else "../"
        ctx = {
            "root": root,
            "title": meta["title"],
            "desc": meta["desc"],
            "page": slug,
            "nav": nav_html(meta.get("nav", ""), root),
            "route": route_html(slug, root),
            "station": station_html(slug),
            "handoff": handoff_html(slug, root),
        }
        html = layout.replace("{{content}}", body.strip())
        html = render(render(html, ctx, icon_map), ctx, icon_map)
        # renders da maquete: serve WebP com versão de 900 px para telas pequenas
        html = re.sub(r'src="((?:\.\./)?)assets/img/3d/([\w-]+)\.jpg"',
                      lambda m: f'src="{m[1]}assets/img/3d/{m[2]}.webp" '
                                f'srcset="{m[1]}assets/img/3d/{m[2]}-900.webp 900w, {m[1]}assets/img/3d/{m[2]}.webp 1600w"', html)
        if VERIFY:
            html = mark_for_verify(html)
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(html, encoding="utf-8")
        print("ok", out.relative_to(ROOT))


if __name__ == "__main__":
    build()
