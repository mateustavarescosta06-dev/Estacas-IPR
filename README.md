# IPR Estacas — site institucional

Site estático (HTML + CSS + JS puro, sem dependências) para **estacasipr.com.br**.

## Estrutura

```
src/
  partials/layout.html   cabeçalho, rodapé e <head> comuns
  partials/cta.html      faixa "Faça um orçamento"
  pages/*.html           conteúdo de cada página (com metadados no topo)
  icons/*.svg            ícones inline
assets/
  css/style.css          sistema visual
  js/main.js             interações (menu, simulador de cravação, catálogo, seletor, FAQ, formulário)
  js/estacas-data.js     dados técnicos das estacas (extraídos dos ábacos em assets/docs)
  js/3d/yard.js          maquete 3D procedural do pátio (Three.js): bate-estacas, pilhas, silos, galpão, caminhão
  js/3d/kit.js, tex.js   peças modeladas e texturas geradas em código
  js/3d/sketch.js        filtro de rascunho técnico (contornos trêmulos + hachura; prancha azul ou papel)
  js/hero3d.js           capa da home com a maquete ao vivo em rascunho (martelo cravando, botão "Cravar")
  vendor/three/          Three.js r169 e módulos usados (sem CDN, via importmap)
  img/3d/                rascunhos renderizados da maquete (WebP 1600 px e 900 px) + og.jpg
src/illustrations/       desenhos técnicos em SVG (insumos, ensaios) com o filtro #rascunho
  img/, clientes/, docs/ fotos, logos de clientes e ábacos em PDF
build.py                 gera index.html e <pagina>/index.html
tools/render.html|.js    renderiza a maquete (assets/img/3d)
tools/webp.py            converte os renders em WebP e gera og.jpg
```

As URLs geradas mantêm as do site atual (`/estacas/`, `/fundacao/`, `/central-de-concreto/`,
`/controle-de-qualidade/`, `/clientes/`, `/perguntas-frequentes/`, `/contato/`).

## Editar e publicar

1. Edite os arquivos em `src/` (ou `assets/`).
2. Rode `python3 build.py`.
3. Visualize localmente: `python3 -m http.server` e abra http://localhost:8000.
4. Publique a raiz do repositório em qualquer hospedagem estática.

### Publicação (Vercel)

O projeto na Vercel está ligado a este repositório: cada push na `main` publica o site em
https://estacas-ipr.vercel.app/ e cada PR ganha um endereço de prévia. Não há etapa de build:
as páginas geradas por `build.py` já ficam versionadas, então rode `python3 build.py` antes do commit.

## Imagens da maquete 3D

As imagens de `assets/img/3d/` são rascunhos técnicos gerados a partir da própria cena 3D,
em dois estilos: `blueprint` (traço claro sobre marinho, para áreas escuras) e `paper`
(grafite sobre papel, para áreas claras). Para ajustar um ângulo, edite `SHOTS` em
`assets/js/3d/yard.js` e rode:

```
npm i playwright
python3 -m http.server 8765 &
CHROME=/caminho/do/chrome STYLE=blueprint node tools/render.js hero estacas
CHROME=/caminho/do/chrome STYLE=paper node tools/render.js pilha
python3 tools/webp.py && python3 build.py
```

Sem WebGL ou com "reduzir movimento" ativo, a capa mostra a imagem estática `3d/hero-blueprint.webp`.

## Verificação de rolagem (scroll-craft)

`python3 build.py --verify` gera uma cópia marcada em `scrollcraft/builds/ipr-rota/site/` (seções como atos,
títulos e parágrafos como cópia, sinal de pronto). Sirva essa pasta e rode o `shoot.mjs` da skill scroll-craft
nela, no desktop, em 390×844 e com `--reduced-motion`. A cópia e as capturas (`lab/`) ficam fora do git.
O cabeçalho é sticky, e o verificador só esconde elementos fixos: texto passando por baixo do cabeçalho aparece
como falha de contraste falsa. Desconte a faixa do cabeçalho ao ler o relatório.

## Observações

- O formulário de contato não depende de servidor: monta a mensagem e abre o WhatsApp
  comercial ou o e-mail. Pode ser ligado a um serviço de formulários depois.
- O simulador de cravação da home é ilustrativo (camadas, golpes e nega fictícios).
