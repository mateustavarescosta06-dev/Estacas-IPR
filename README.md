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
  js/fabrica3d.js        maquete 3D procedural do pátio (Three.js): bate-estacas, pilhas, silos, galpão, caminhão
  js/hero3d.js           capa da home com a maquete ao vivo (martelo cravando, botão "Cravar")
  vendor/                Three.js r169 (sem CDN)
  img/3d/                imagens renderizadas da maquete
  img/, clientes/, docs/ fotos, logos de clientes e ábacos em PDF
build.py                 gera index.html e <pagina>/index.html
tools/render.html|.js    renderiza a maquete em JPG (assets/img/3d)
```

As URLs geradas mantêm as do site atual (`/estacas/`, `/fundacao/`, `/central-de-concreto/`,
`/controle-de-qualidade/`, `/clientes/`, `/perguntas-frequentes/`, `/contato/`).

## Editar e publicar

1. Edite os arquivos em `src/` (ou `assets/`).
2. Rode `python3 build.py`.
3. Visualize localmente: `python3 -m http.server` e abra http://localhost:8000.
4. Publique a raiz do repositório em qualquer hospedagem estática.

Para incluir/alterar uma estaca, edite `assets/js/estacas-data.js` e coloque o PDF em `assets/docs/`.

## Imagens da maquete 3D

As imagens de `assets/img/3d/` são geradas a partir da própria cena 3D. Para ajustar um
ângulo, edite `SHOTS` em `assets/js/fabrica3d.js` e rode:

```
npm i playwright
python3 -m http.server 8765 &
CHROME=/caminho/do/chrome node tools/render.js            # todas
CHROME=/caminho/do/chrome node tools/render.js hero       # só uma
```

Sem WebGL ou com "reduzir movimento" ativo, a capa mostra a imagem estática `3d/hero.jpg`.

## Observações

- O formulário de contato não depende de servidor: monta a mensagem e abre o WhatsApp
  comercial ou o e-mail. Pode ser ligado a um serviço de formulários depois.
- O simulador de cravação da home é ilustrativo (camadas, golpes e nega fictícios).
