# Higgsfield: kit de produção do site IPR

O site já funciona com as fotos reais da fábrica (`media/src`). Este guia descreve como trocar cada
cena por uma versão gerada no Higgsfield, **partindo dessas mesmas fotos**, e como os clipes viram
interação: a rolagem conduz o vídeo e o último quadro de uma página é o primeiro da seguinte.

A pesquisa completa (modelos, custos, fontes) está no relatório *Fábrica de estacas e Higgsfield*.

## Antes de começar

- **Plano.** A produção inteira custa cerca de 600 créditos. O Starter (270/mês) não cobre; o Plus
  (US$ 59, 1.200 créditos) cobre com folga. Assine por um mês, produza tudo e volte ao Starter.
  Créditos de assinatura não acumulam. Gere tudo num plano pago: o gratuito põe marca d'água.
- **Onde gerar.** Na interface web do Higgsfield. O conector ligado ao Claude só lê (lista modelos,
  saldo e gerações). Depois de gerar, peça ao Claude para buscar suas gerações e encaixá-las aqui.
- **Autenticidade.** Use a foto real como quadro inicial ou referência em todas as cenas. Não peça
  vapor de cura, pórtico rolante ou corte a maçarico enquanto a IPR não confirmar que existem.
  O aço das estacas IPR são **fios** de protensão lisos de 4 a 6 mm (6 por seção, 8 na quadrada),
  não cordoalhas grossas: nas imagens eles parecem cordas de instrumento.
- **Uma só luz.** Fim de tarde, sol à esquerda da câmera, cerca de 35° de altura, em todas as cenas
  de fábrica. Só o Contato escurece (crepúsculo).

## Preâmbulo de estilo (igual em todos os prompts)

Copie sem alterar e troque apenas a linha `SUBJECT`.

```text
Photoreal documentary industrial photograph, editorial annual-report quality.
Precast prestressed concrete pile factory in the interior of São Paulo state, Brazil, dry season.
Late-afternoon sun from camera-left at about 35° elevation, soft haze, long shadows.
Palette: neutral concrete greys, deep red laterite soil, yellow cement silos, steel blue-grey, pale hazy sky.
Full-frame cinema camera, 35mm lens, f/8, 1/500s, ISO 200, tripod at 1.7 m, horizon level, natural colour, fine grain.
SUBJECT: <a cena>
No text, no signage, no logos, no watermark, no lens flare, no people in the foreground.
```

## As cenas do site

Cada cena tem um nome fixo (`media/slots.json`). O arquivo que você salvar em `media/src` com esse
nome entra no lugar certo do site.

| Cena | Onde aparece | Foto real de partida | O que gerar | Formato |
|---|---|---|---|---|
| `patio-pistas` | Abertura da home | `pistas-silos.jpg` | Still da pista em perspectiva com os silos ao fundo | 16:9, 4K |
| `patio-pistas-frente` | Camada da frente da abertura | o still acima | Recorte do primeiro plano (pista e barras transversais) com transparência | PNG com alfa |
| `silos` | Capa da Central de Concreto | `silos.jpg` | Silos amarelos contra o céu de fim de tarde | 4:5, 2K |
| `aco-rolo` | Capa de Estacas | `cordoalha-rolo.jpg` | Rolo de fio de protensão, luz rasante | 4:5, 2K |
| `corpos-de-prova` | Capa do Controle de Qualidade | `corpos-de-prova.jpg` | Tipologia de corpos de prova, luz difusa | 4:5, 2K |
| `transporte` | Capa da Fundação | `transporte.jpg` | Içamento das estacas para a carreta (manter o capacete IPR) | 4:5, 2K |
| `patio-vsco` | Capa de Clientes | `patio-vsco.jpg` | Pátio de estocagem em plano aberto e elevado | 4:5, 2K |
| `topos` | Capa de Perguntas Frequentes | `pilha-circular.jpg` | Topos de estacas, textura do concreto (olhar Hélène Binet) | 4:5, 2K |
| `patio-nublado` | Capa do Contato | `patio-nublado.jpg` | O pátio ao anoitecer, primeiras luzes de sódio | 4:5, 2K |

As capas aparecem quase quadradas na tela (no computador e no celular). Gere em 4:5 e mantenha o
assunto no centro: o site recorta o excedente.

### Stills: a foto real vira quadro-chave

1. **Upscale fiel.** Topaz *High Fidelity V2* (×2 ou ×3). Não use o modo *Redefine*: ele inventa peças.
2. **Relight.** Sol de fim de tarde à esquerda da câmera, para todas as fotos terem a mesma luz.
3. **Outpaint** (FLUX.2 Pro Outpaint) quando faltar enquadramento: a `pistas-silos.jpg` é 4:3 e
   precisa virar 16:9 (mais céu em cima, mais pátio nas laterais).
4. **Limpeza** com inpaint por máscara (entulho, fios soltos, placas). Mantenha o logotipo IPR do
   capacete e os números do painel como estão: mascare essas áreas.
5. Para ângulos que não existem em foto, use Nano Banana 2.1 com 3 a 6 fotos reais como referência,
   o preâmbulo acima e um `seed` fixo para as variações do mesmo plano.

Salve como `media/src/<cena>-hf.jpg` e troque o `src` da cena em `media/slots.json` para esse arquivo
(a foto original fica guardada). Se a geração já saiu no visual da série, use `"grade": "original"`.

**Camada da frente.** Rode *Image Decompose* (modo standard) no still 16:9 da abertura, exporte o
plano mais próximo com fundo transparente e salve como `media/src/patio-pistas-frente.png`. Na
rolagem ele anda mais rápido que o fundo, o que dá profundidade à abertura. Teste antes o formato
de saída do Decompose, que não é documentado.

### Clipes: a rolagem conduz o vídeo

**Passagens (fim de cada página).** Cada passagem é um clipe Kling 3.0 em modo *start/end frame*:
o quadro inicial é a cena desta página e o quadro final é a capa da próxima. No site, o clipe avança
conforme o visitante chega à "Próxima etapa" e para exatamente no quadro que abre a página seguinte.
O arquivo recebe **o nome da cena de destino**.

| Arquivo | Passagem | Quadro inicial | Quadro final | Movimento (prompt) |
|---|---|---|---|---|
| `silos.mp4` | Início → Central | recorte 1:1 do still `patio-pistas`, centrado nos silos | still `silos` (1:1) | Slow continuous dolly forward along the prestressing bed toward the yellow cement silos, 6 meters over 8 seconds, constant speed, gentle ease-out. |
| `aco-rolo.mp4` | Central → Estacas | `silos` | `aco-rolo` | Slow continuous push-in; the curved yellow silo surface fills the frame and resolves into the curved coils of smooth steel prestressing wire, one continuous move. |
| `corpos-de-prova.mp4` | Estacas → Qualidade | `aco-rolo` | `corpos-de-prova` | Slow continuous dolly back; the circles of the wire coil resolve into the circular ends of stacked concrete test cylinders, one continuous move. |
| `transporte.mp4` | Qualidade → Fundação | `corpos-de-prova` | `transporte` | Slow continuous pull back and crane up from the cylinder ends to the hollow hexagonal pile ends being loaded onto the truck. |
| `patio-vsco.mp4` | Fundação → Clientes | `transporte` | `patio-vsco` | Slow continuous crane up and pull back from the truck to the wide elevated view of the stockyard. |

Em todos os prompts de passagem, acrescente depois do movimento:

```text
No zoom, no tilt, no cuts, horizon level, lighting unchanged, no people entering the frame.
```

Configuração: Kling 3.0, proporção **1:1**, **1080p**, 6 a 8 s, som desligado, multi-shot desligado.
Rascunhe em 720p e finalize em 1080p. Um movimento por plano; se o clipe derivar, simplifique o
prompt e deixe os quadros conduzirem. Clientes → Perguntas → Contato ficam só na costura de cor.

**Loop da abertura.** `patio-pistas.mp4`: Kling 3.0, 16:9, 1080p, 5 a 10 s, com o mesmo still como
quadro inicial **e** final.

```text
Locked-off static camera. Only the atmosphere moves: light dust drifting low over the beds from left
to right, thin heat haze above the red soil, clouds sliding slowly. No camera movement, no zoom,
no people, lighting unchanged.
```

Se sair quase parado, use o método de dois clipes: gere o clipe 1, gere o clipe 2 começando no último
quadro do 1 e terminando no primeiro, e junte os dois.

**Continuidade de pixel.** Para garantir que o fim de um clipe é o começo da página seguinte, extraia
o último quadro real e use-o como still da cena de destino:

```bash
ffmpeg -sseof -0.1 -i silos.mp4 -frames:v 1 silos-ultimo.png
```

## Colocar no site

1. Salve stills e clipes em `media/src` com o nome da cena (tabelas acima).
2. Gere as versões para a web (gradação, AVIF/WebP em três larguras, vídeo com quadro-chave a cada
   2 quadros para a rolagem, versão de celular e pôster):

```bash
python tools/media.py
```

3. Monte as páginas:

```bash
python build.py
```

4. Veja localmente:

```bash
python -m http.server 8765
```

e abra http://localhost:8765. O site baixa cada clipe inteiro antes de ligá-lo à rolagem, então a
busca de quadros é instantânea. Com "reduzir movimento" ativo, nenhum vídeo carrega e ficam as fotos.

## Custos estimados

| Item | Quantidade | Créditos |
|---|---|---|
| Stills 4K (Nano Banana Pro), 4 tentativas cada | 8 cenas | ~130 |
| Upscale, relight, outpaint e inpaint das fotos reais | ~20 operações | ~50 |
| Passagens Kling 3.0, 8 s em 1080p, 3 tentativas | 5 clipes | ~300 |
| Loop da abertura, 2 tentativas | 1 clipe | ~25 |
| **Total** | | **~500 a 600** |

Valores de outubro de 2026, a partir da tabela de créditos do Higgsfield. Confira no app antes de assinar.

## O que vale mais que qualquer geração

Uma manhã de fotos na fábrica e numa obra: o bate-estacas trabalhando, a liberação dos fios na
cabeceira, o painel da central limpo. Com isso, a corrente de quadros-chave nasce inteira de material
verdadeiro, e o Higgsfield entra só para dar movimento e acabamento.
