# IPR Estacas — site institucional

Site estático (HTML + CSS + JS puro, sem dependências) para **estacasipr.com.br**.

## A ideia

O site segue a vida de uma estaca, na ordem em que ela é feita: a matéria (Central de Concreto),
o aço e a forma (Estacas), a cura e o ensaio (Controle de Qualidade), o solo (Fundação), a obra de pé
(Clientes), as dúvidas e, no fim, a nega (Contato).

- **Cor = material.** Cada trecho declara um tom (`data-tone`): cimento, agregado, aço, concreto curado,
  latossolo, concreto aparente, prancheta, noite. O fundo interpola devagar entre eles, como luz.
- **O fim de uma página é a capa da próxima.** A passagem no pé de cada página monta exatamente a
  abertura da página seguinte (mesmo título, mesma foto no mesmo lugar, mesmo tom). Com view
  transitions, o clique vira um só movimento.
- **Fios de protensão.** Seis linhas finas se tensionam quando a passagem chega e, na página seguinte,
  são liberadas a partir do centro, como na desprotensão.
- **Nada reage ao ponteiro.** O movimento vem da rolagem e do próprio processo.

## Estrutura

```
src/
  partials/layout.html   cabeçalho, linha de produção, rodapé e <head> comuns
  pages/*.html           conteúdo de cada página (com metadados no topo)
  icons/*.svg            ícones inline
media/
  src/                   fotos reais da fábrica (e, depois, as gerações do Higgsfield)
  slots.json             as cenas do site: arquivo de origem, gradação, ponto focal e texto alternativo
  HIGGSFIELD.md          kit de produção: prompts, câmeras, quadros de início e fim, custos
assets/
  css/style.css          sistema visual (tons, tipografia, componentes)
  js/jornada.js          tom por trecho, profundidade das fotos, linha de produção, fios, passagens, clipes
  js/main.js             menu, simulador de cravação, catálogo, seletor, ensaios, FAQ, formulário
  js/estacas-data.js     dados técnicos das estacas (extraídos dos ábacos em assets/docs)
  media/                 imagens e clipes gerados por tools/media.py (não editar à mão)
  clientes/, docs/       logos de clientes e ábacos em PDF
tools/media.py           gradação da série, AVIF/WebP em três larguras, clipes de rolagem
build.py                 gera index.html e <pagina>/index.html
```

A ordem das páginas, os tons e as cenas de cada capa ficam em `ROUTE` e `TONES`, no `build.py`.
As URLs mantêm as do site atual (`/estacas/`, `/fundacao/`, `/central-de-concreto/`,
`/controle-de-qualidade/`, `/clientes/`, `/perguntas-frequentes/`, `/contato/`).

## Editar e publicar

1. Edite os arquivos em `src/` (ou `assets/`).
2. Se trocou imagens ou clipes em `media/src`, rode `python tools/media.py`.
3. Rode `python build.py`.
4. Visualize localmente: `python -m http.server 8765` e abra http://localhost:8765.
5. Publique a raiz do repositório (a Vercel serve os arquivos como estão).

Para incluir ou alterar uma estaca, edite `assets/js/estacas-data.js` e coloque o PDF em `assets/docs/`.

## Imagens

As fotos vêm do acervo real da IPR e passam pela mesma gradação (`tools/media.py`): céu menos
saturado, pretos levemente erguidos, altas luzes quentes, para que fotos de dias diferentes pareçam
uma série. Para gerar versões em alta resolução, clipes de passagem e camadas de profundidade no
Higgsfield, siga `media/HIGGSFIELD.md`. O site já aceita esses arquivos: basta salvá-los em
`media/src` com o nome da cena e rodar os dois comandos acima.

## Observações

- O formulário de contato não depende de servidor: monta a mensagem e abre o WhatsApp
  comercial ou o e-mail.
- O simulador de cravação da home é ilustrativo (camadas, golpes e nega fictícios).
- Com "reduzir movimento" ativo, não há rolagem conduzida nem vídeo: as seções viram blocos
  estáticos e as fotos ficam no lugar dos clipes.
- A maquete 3D anterior (`assets/js/3d`, `assets/vendor/three`, `tools/render.*`) não é mais
  carregada por nenhuma página e pode ser removida.
