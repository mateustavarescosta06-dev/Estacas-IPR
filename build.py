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
    {{root}}                     caminho relativo até a raiz do site ("" ou "../")
    {{icon:nome}}                ícone SVG inline (ver src/icons/)
    {{amostra}}                  chip de material da etapa desta página
    {{capa}}                     a cena da capa desta página (foto da etapa, carregamento prioritário)
    {{fios}}                     fios de protensão que se soltam na capa (quando se chega pela passagem)
    {{foto:cena|proporção|legenda|classes}}   figura com foto tratada (media/slots.json)
    {{img:cena|sizes}}           só o <picture>, com carregamento preguiçoso ({{img!:...}} carrega com prioridade)
    {{tom:cena}}                 cor média da cena (fundo de espera do contêiner)
    {{cor:tom}}                  cor de amostra de um tom de material (TONES)

Antes do build, rode tools/media.py para gerar assets/media a partir de media/src.
"""
import html as H
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).parent
# --verify gera uma cópia com marcações do verificador scroll-craft (data-sc-act / data-sc-copy)
VERIFY = "--verify" in sys.argv
OUT = ROOT / "scrollcraft" / "builds" / "ipr-jornada" / "site" if VERIFY else ROOT
SRC = ROOT / "src"
MEDIA = json.loads((ROOT / "assets" / "media" / "manifest.json").read_text(encoding="utf-8"))

# Tons de material: fundo, tinta, tinta secundária, amostra (a cor do material na etiqueta).
# Paleta da marca: o azul-marinho domina, o branco é respiro, o amarelo é luz e ação.
# fundo, tinta, tinta secundária, marca (o chip de etapa)
TONES = {
    "patio":   ("#ffffff", "#0a1f3d", "#51607a", "#ffcd00"),   # azul-marinho IPR
    "materia": ("#ffffff", "#0a1f3d", "#51607a", "#ffcd00"),   # branco
    "aco":     ("#ffffff", "#0a1f3d", "#51607a", "#ffcd00"),   # noite
    "cura":    ("#ffffff", "#0a1f3d", "#51607a", "#ffcd00"),   # névoa clara
    "terra":   ("#ffffff", "#0a1f3d", "#51607a", "#ffcd00"),   # azul do dia
    "obra":    ("#ffffff", "#0a1f3d", "#51607a", "#ffcd00"),
    "papel":   ("#ffffff", "#0a1f3d", "#51607a", "#ffcd00"),
    "noite":   ("#ffffff", "#0a1f3d", "#51607a", "#ffcd00"),
}

# A ordem das páginas é a vida de uma estaca: matéria, aço, cura, solo, obra.
# (slug, chave do menu, rótulo, caminho, tom, material, chamada da passagem, cena da capa)
ROUTE = [
    ("index", "home", "Início", "", "patio", "O pátio",
     "Onde tudo começa: a fábrica, as pistas e a cravação.", "patio-pistas"),
    ("central-de-concreto", "central", "Central de Concreto", "central-de-concreto/", "materia", "A matéria",
     "Cimento, areia e brita pesados na balança e registrados metro cúbico a metro cúbico.", "silos"),
    ("estacas", "estacas", "Estacas", "estacas/", "aco", "O aço e a forma",
     "Fios de protensão tracionados na pista, fôrmas metálicas e onze seções com ábaco próprio.", "aco-rolo"),
    ("controle-de-qualidade", "qualidade", "Controle de Qualidade", "controle-de-qualidade/", "cura", "A cura e o ensaio",
     "Cada lote rompido com 24 horas, 3, 7 e 28 dias. Cada peça inspecionada antes do pátio.", "corpos-de-prova"),
    ("fundacao", "fundacao", "Fundação", "fundacao/", "terra", "O solo",
     "A estaca deixa o pátio na frota própria e é cravada, emendada e verificada golpe a golpe.", "transporte"),
    ("clientes", "clientes", "Clientes", "clientes/", "obra", "A obra de pé",
     "Indústria, varejo e infraestrutura que já estão apoiados em estacas IPR.", "patio-vsco"),
    ("perguntas-frequentes", "faq", "Perguntas Frequentes", "perguntas-frequentes/", "papel", "As dúvidas",
     "Nega, emendas, solo e transporte, em respostas curtas da engenharia.", "topos"),
    ("contato", "contato", "Contato", "contato/", "noite", "A nega",
     "A próxima estaca a sair da pista é a da sua obra.", "patio-nublado"),
]
# A cor de cada página interna (referência carmofarm.com), dentro da paleta da marca: uma faixa
# num tom do azul-marinho onde abre o título, o título em branco ou amarelo e o papel claro de chão.
CORES = {
    "central-de-concreto":   ("#0f2c55", "#ffffff", "#fbfaf7"),
    "estacas":               ("#0a1f3d", "#ffcd00", "#fbfaf7"),
    "controle-de-qualidade": ("#143a6b", "#ffffff", "#fbfaf7"),
    "fundacao":              ("#0a1f3d", "#ffffff", "#fbfaf7"),
    "clientes":              ("#0f2c55", "#ffcd00", "#fbfaf7"),
    "perguntas-frequentes":  ("#071428", "#ffffff", "#fbfaf7"),
    "contato":               ("#071428", "#ffcd00", "#fbfaf7"),
}


def cores(slug):
    if slug not in CORES:
        return ""
    f, t, c = CORES[slug]
    return f"--faixa:{f};--faixa-t:{t};--chao:{c}"


# a seção desenhada na abertura de cada página (ábacos IPR)
DESENHO = {"central-de-concreto": "C30", "estacas": "H33", "controle-de-qualidade": "Q30", "fundacao": "H28",
           "clientes": "C26", "perguntas-frequentes": "HV40", "contato": "H33"}
# rótulos curtos no menu (o nome completo aparece na linha de produção e nas passagens)
SHORT = {"central": "Central", "qualidade": "Qualidade", "faq": "Dúvidas"}
NAV = [(key, SHORT.get(key, label), href, tone) for _, key, label, href, tone, *_ in ROUTE if key != "contato"]


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


# ---------- Imagens ----------

def picture(slot, root, sizes="100vw", eager=False, alt=None):
    m = MEDIA[slot]
    base = f"{root}assets/media/{slot}"
    ws = m["widths"]
    srcset = lambda ext: ", ".join(f"{base}-{w}.{ext} {w}w" for w in ws)
    alt = H.escape(m["alt"] if alt is None else alt, quote=True)
    load = 'fetchpriority="high" decoding="async"' if eager else 'loading="lazy" decoding="async"'
    return (f'<picture><source type="image/avif" srcset="{srcset("avif")}" sizes="{sizes}">'
            f'<img src="{base}-{ws[-1]}.webp" srcset="{srcset("webp")}" sizes="{sizes}" '
            f'width="{m["w"]}" height="{m["h"]}" alt="{alt}" {load} style="--pos:{m["pos"]}"></picture>')


def video_tag(slot, root, cls, scrub):
    """Clipe do Higgsfield já codificado por tools/media.py (1600 px e 720 px para celular)."""
    base = f"{root}assets/media/{slot}"
    if scrub:
        # o clipe de rolagem é baixado inteiro pelo jornada.js antes de responder à rolagem
        return (f'<video class="{cls}" muted playsinline preload="none" data-scrub data-src="{base}.mp4" '
                f'data-src-m="{base}-m.mp4" poster="{base}-poster.webp" aria-hidden="true" tabindex="-1"></video>')
    return (f'<video class="{cls}" muted playsinline loop preload="none" data-loop poster="{base}-poster.webp" '
            f'aria-hidden="true" tabindex="-1"><source src="{base}-m.mp4" type="video/mp4" media="(max-width: 820px)">'
            f'<source src="{base}.mp4" type="video/mp4"></video>')


def abertura_extra(root):
    """Camadas opcionais da abertura: loop ambiente (patio-pistas.mp4) e recorte da frente (patio-pistas-frente)."""
    out = ""
    if MEDIA.get("patio-pistas", {}).get("video"):
        out += video_tag("patio-pistas", root, "abertura__video", scrub=False)
    if "patio-pistas-frente" in MEDIA:
        out += (f'<div class="abertura__frente" data-depth="-0.12">'
                f'{picture("patio-pistas-frente", root, "100vw", alt="")}</div>')
    return out


def fundo_tag(slot, root):
    """O pátio real atrás da estaca 3D: time-lapse desfocado, levado à hora da cena pelo historia.js."""
    if not MEDIA.get(slot, {}).get("fundo"):
        return ""
    base = f"{root}assets/media/{slot}-fundo"
    return (f'<video class="dia__fundo" muted playsinline preload="none" data-fundo data-src="{base}.mp4" '
            f'poster="{base}-poster.webp" aria-hidden="true" tabindex="-1"></video>')


def faixa(spec, root):
    """Imagem de ponta a ponta entre dois trechos: {{faixa:cena|legenda}}."""
    slot, _, caption = spec.partition("|")
    cap = f'<figcaption class="wrap"><span>{caption}</span></figcaption>' if caption else ""
    return (f'<figure class="faixa"><div class="placa"><div class="cena grao faixa__cena" data-par style="{scene_style(slot)}">'
            f'{picture(slot, root, "(max-width: 820px) 100vw, 1280px")}</div></div>{cap}</figure>')


def scene_style(slot):
    return f'--tone-img:{MEDIA[slot]["tone"]}'


def foto(spec, root):
    parts = spec.split("|")
    slot, ar = parts[0], (parts[1] if len(parts) > 1 and parts[1] else "4/5")
    caption = parts[2] if len(parts) > 2 else ""
    extra = parts[3] if len(parts) > 3 else ""
    cap = f"<figcaption><span>{caption}</span></figcaption>" if caption else ""
    return (f'<figure class="foto reveal {extra}" style="--ar:{ar}"><div class="placa">'
            f'<div class="cena grao" data-par style="{scene_style(slot)}">'
            f'{picture(slot, root, "(max-width: 820px) 100vw, 50vw")}</div></div>{cap}</figure>')


# ---------- Peças da jornada ----------

def route_index(slug):
    return next(i for i, r in enumerate(ROUTE) if r[0] == slug)


def amostra(tone, text):
    return f'<span class="amostra" style="--c:{TONES[tone][3]}"><i></i>{text}</span>'


def fios(mode):
    """Seis fios de protensão. 'tensao': com folga, esticam ao fim da página. 'soltar': cortados na capa."""
    ys = [12 + i * 12 for i in range(6)]
    if mode == "tensao":
        lines = "".join(f'<path data-fio d="M0 {y} Q500 {y + 34} 1000 {y}"/>' for y in ys)
        lines += "".join(f'<path class="brilho" pathLength="1000" style="--i:{i}" d="M0 {y} L1000 {y}"/>' for i, y in enumerate(ys))
        extra = '<span class="fios__leitura">Protensão aplicada</span>'
        attr = " data-fios"
    else:
        lines = "".join(
            f'<line class="metade metade--e" style="--i:{i}" x1="0" y1="{y}" x2="500" y2="{y}"/>'
            f'<line class="metade metade--d" style="--i:{i}" x1="500" y1="{y}" x2="1000" y2="{y}"/>'
            for i, y in enumerate(ys))
        extra, attr = "", ""
    return (f'<div class="fios"{attr} aria-hidden="true"><svg viewBox="0 0 1000 84" preserveAspectRatio="none">'
            f'{lines}</svg>{extra}</div>')


def linha_html(slug, root):
    """A linha de produção no pé do cabeçalho: uma marca por etapa, a atual em amarelo."""
    i, n = route_index(slug), len(ROUTE)
    items = []
    for j, (_, _, label, href, tone, material, *_r) in enumerate(ROUTE):
        state = "is-here" if j == i else ("is-past" if j < i else "")
        cur = ' aria-current="step"' if j == i else ""
        items.append(f'<li class="{state}" style="--at:{(j + .5) / n * 100:.3f}"><a href="{root}{href}"{cur}>'
                     f'<span>{label} · {material}</span></a></li>')
    return (f'<nav class="linha" aria-label="Etapas da estaca, da matéria à nega" data-linha data-step="{i}" data-n="{n}">'
            f'<span class="linha__fill" data-linha-fill></span><ol>{"".join(items)}</ol></nav>')


def h1_of(slug):
    raw = read(f"pages/{slug}.html")
    m = re.search(r"<h1[^>]*>(.*?)</h1>", raw, re.S)
    text = re.sub(r"<(?!/?span\b)[^>]+>", "", m.group(1)) if m else ""
    # mantém só os spans de destaque (.hl); as linhas de animação da home viram texto corrido
    text = re.sub(r'<span class="line"[^>]*>|<span style="--i:\d+">', "", text)
    text = re.sub(r"</span>(\s*)</span>", r"</span>\1", text)
    return re.sub(r"\s+", " ", text).strip()


def lead_of(slug):
    raw = read(f"pages/{slug}.html")
    m = re.search(r'<p class="lead">(.*?)</p>', raw, re.S)
    return m.group(1).strip() if m else ""


def passagem_html(slug, root):
    """O fim da página é a abertura da próxima, idêntica: ao clicar, os mesmos elementos deslizam
    para o lugar e a troca de página não aparece."""
    i = route_index(slug)
    if i + 1 >= len(ROUTE):
        return fim_html(root)
    nslug, _, label, href, tone, material, teaser, scene = ROUTE[i + 1]
    return (f'<section class="capa capa--seguinte" data-faixa style="{cores(nslug)}" aria-label="Próxima etapa: {label}">'
            f'<div class="capa__faixa" aria-hidden="true"></div>'
            f'<a class="capa__seguir-area" href="{root}{href}" data-passagem aria-label="Seguir para {label}"></a>'
            f'<div class="wrap capa__grid"><div class="capa__txt">'
            f'<nav class="crumbs" aria-label="Próxima etapa"><span>Próxima etapa</span><span aria-hidden="true">/</span><span>{label}</span></nav>'
            f'<div class="desenho capa__desenho" data-desenho="{DESENHO.get(nslug, "H33")}" aria-hidden="true"></div>'
            f'<h2 class="h-xl">{h1_of(nslug)}</h2>'
            f'<p class="lead">{lead_of(nslug)}</p>'
            f'<a class="capa__seguir" href="{root}{href}" data-passagem>Seguir para {label} {{{{icon:arrow}}}}</a></div>'
            f'<figure class="capa__figura"><div class="placa"><div class="cena capa__cena" data-par style="{scene_style(scene)}">'
            f'{picture(scene, root, "(max-width: 820px) 100vw, 55vw", alt="")}</div></div>'
            f'<figcaption>{MEDIA[scene]["alt"]}</figcaption></figure></div></section>')


def fim_html(root):
    return (f'<section class="fim" aria-label="Fim do percurso"><div class="wrap">'
            f'<h2 class="h-xl">A próxima estaca a sair da pista é a da sua obra.</h2>'
            f'<p class="lead">Você percorreu a fábrica inteira, da matéria à nega. Envie a sondagem e as cargas de projeto: '
            f'a engenharia da IPR retorna com a seção indicada e o orçamento.</p>'
            f'<a class="btn btn--ink" href="{root}">Voltar ao pátio {{{{icon:arrow}}}}</a></div></section>')


def nav_html(active, root):
    items = []
    for key, label, href, tone in NAV:
        cls = ' aria-current="page"' if key == active else ""
        items.append(f'<li><a href="{root}{href}" style="--c:{TONES[tone][3]}"{cls}>{label}</a></li>')
    return "\n".join(items)


def tones_css(base):
    rules = [f"html{{background:{TONES[base][0]}}}"]
    for name, (g, ink, ink2, mark) in TONES.items():
        rules.append(f'body[data-tone="{name}"]{{--ground:{g};--ink:{ink};--ink-2:{ink2};--mark:{mark}}}')
    return "".join(rules)


def render(text, ctx, icon_map):
    root = ctx["root"]
    text = re.sub(r'<div class="marquee" data-marquee="(a|b)"></div>',
                  lambda m: f'<div class="marquee">{marquee(m.group(1), root)}</div>', text)
    text = text.replace("{{logos}}", logo_tiles(CLIENTES, root))
    text = re.sub(r"\{\{foto:([^}]+)\}\}", lambda m: foto(m.group(1), root), text)
    # {{img!:...}} carrega com prioridade (a imagem da abertura); {{img:...}} espera a rolagem
    text = re.sub(r"\{\{img(!?):([\w-]+)(?:\|([^}]*))?\}\}",
                  lambda m: picture(m.group(2), root, m.group(3) or "(max-width: 820px) 100vw, 50vw", eager=bool(m.group(1))), text)
    # {{loop:cena}}: loop ambiente de câmera parada sobre a foto, só se existir media/src/<cena>.mp4
    text = re.sub(r"\{\{loop:([\w-]+)\}\}",
                  lambda m: video_tag(m.group(1), root, "intervalo__video", scrub=False)
                  if MEDIA.get(m.group(1), {}).get("video") else "", text)
    text = re.sub(r"\{\{fundo:([\w-]+)\}\}", lambda m: fundo_tag(m.group(1), root), text)
    text = re.sub(r"\{\{faixa:([^}]+)\}\}", lambda m: faixa(m.group(1), root), text)
    text = re.sub(r"\{\{tom:([\w-]+)\}\}", lambda m: scene_style(m.group(1)), text)
    text = re.sub(r"\{\{cor:(\w+)\}\}", lambda m: TONES[m.group(1)][3], text)
    text = re.sub(r"\{\{icon:([\w-]+)\}\}", lambda m: icon_map[m.group(1)], text)
    for key, value in ctx.items():
        text = text.replace("{{" + key + "}}", value)
    return text


def mark_for_verify(html):
    """Marca seções como atos e blocos de texto como cópia, só para o verificador."""
    html = re.sub(r'<section class="([^"]*\b(?:drive|trilho)\b[^"]*)"', r'<section data-sc-act="pin" class="\1"', html)
    html = re.sub(r'<section(?! data-sc-act)( [^>]*)?>', lambda m: f'<section data-sc-act="flow"{m.group(1) or ""}>', html)
    main = html.split("<main", 1)
    if len(main) == 2:
        main[1] = re.sub(r"<(h1|h2|h3|p)(?=[\s>])", r"<\1 data-sc-copy", main[1])
        html = "<main".join(main)
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
        i = route_index(slug)
        _, _, label, _href, tone, material, _teaser, scene = ROUTE[i]
        out = OUT / ("index.html" if slug == "index" else f"{slug}/index.html")
        root = "" if slug == "index" else "../"
        nxt = ROUTE[i + 1][3] if i + 1 < len(ROUTE) else None
        ctx = {
            "root": root,
            "title": meta["title"],
            "desc": meta["desc"],
            "page": slug,
            "tone": tone,
            "cores": cores(slug),
            "ground": TONES[tone][0],
            "tones": tones_css(tone),
            "nav": nav_html(meta.get("nav", ""), root),
            "linha": linha_html(slug, root),
            "amostra": f'<div class="desenho capa__desenho" data-desenho="{DESENHO.get(slug, "H33")}" aria-hidden="true"></div>',
            "capa": (f'<figure class="capa__figura"><div class="placa"><div class="cena grao capa__cena" data-par style="{scene_style(scene)}">'
                     f'{picture(scene, root, "(max-width: 820px) 100vw, 55vw", eager=True)}</div></div>'
                     f'<figcaption>{MEDIA[scene]["alt"]}</figcaption></figure>'),
            "fios": fios("soltar"),
            "abertura-extra": abertura_extra(root),
            "passagem": passagem_html(slug, root),
            "speculation": (f'<script type="speculationrules">{{"prerender":[{{"urls":["{root}{nxt}"],"eagerness":"moderate"}}]}}</script>'
                            if nxt is not None else ""),
        }
        body = body.replace('<section class="capa">', '<section class="capa" data-faixa><div class="capa__faixa" aria-hidden="true"></div>', 1)
        html = layout.replace("{{content}}", body.strip())
        html = render(render(html, ctx, icon_map), ctx, icon_map)
        if VERIFY:
            html = mark_for_verify(html)
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(html, encoding="utf-8")
        print("ok", out.relative_to(ROOT))


if __name__ == "__main__":
    build()
