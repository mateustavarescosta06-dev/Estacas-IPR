# IPR Estacas — site institucional

Site estático (HTML + CSS + JS puro, sem dependências) para **estacasipr.com.br**.

## A ideia

**Home: 24 horas na fábrica.** A rolagem é o relógio da fábrica, de 05:40 às 06:00 do dia seguinte: o
ciclo real em que uma estaca nasce (a IPR rompe um corpo de prova com 24 horas para liberar a peça).

- **Paleta da marca.** O azul-marinho domina (a noite, a madrugada e o dia são tons de azul), o branco é
  respiro e o amarelo é luz: o relógio, o sol baixo do fim de tarde, as lâmpadas de sódio, as ações.
- **A estaca 3D que se monta** (`assets/js/3d/estaca.js`): pista, cabeceiras, fôrma metálica, os fios de
  protensão esticando, o concreto enchendo a fôrma, a cura mudando a cor, o ensaio na prensa, a
  liberação e a peça girando para mostrar a seção. As seções e os fios vêm dos ábacos (`estacas-data.js`).
- **Monte a sua estaca.** O visitante escolhe a geometria e a bitola e a estaca se monta de novo
  naquela seção, com a ficha técnica ao lado e um controle para percorrer a montagem.
- **Interlúdios por hora** (05:40, 07:30, 10:00, 22:00): hoje fotos reais gradadas para a hora do dia;
  amanhã os clipes do Higgsfield, com os mesmos nomes de cena (`scrollcraft/builds/ipr-24h/ROTEIRO.md`).
- Nas páginas internas, o fim de cada página monta a capa da seguinte e a troca é costurada por view
  transitions; os fios de protensão se tensionam ao fim e são liberados no começo da próxima.

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
  js/historia.js         home: relógio das 24 horas, luz por hora, capítulos e a estaca em corte
  js/3d/estaca.js        a estaca 3D que se monta (three.js, sem dependências externas)
  js/jornada.js          tom por trecho, profundidade das fotos, fios, passagens, clipes
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
- Da maquete 3D anterior, só `assets/js/3d/tex.js` (texturas procedurais) e `assets/vendor/three`
  continuam em uso; `yard.js`, `kit.js`, `sketch.js` e `tools/render.*` podem ser removidos.
