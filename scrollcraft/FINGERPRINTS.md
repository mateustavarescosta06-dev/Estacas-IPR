# Fingerprints

Every site you build with **scroll-craft** gets one row here, appended after it
ships. The registry exists so your next build can prove it is a different page
rather than a re-skin of one you already made.

This file is **yours**. It starts empty on purpose: the gate is about not
repeating *yourself*, so it has nothing to say until you have built something.

The rules and the gate live in the skill's
`references/uniqueness.md`. Short version:

**A new build must differ from EVERY row below on at least 4 of the 6
dimensions.** Four against each row individually, not four on average across the
table. If a planned build fails, change the plan. Never edit a row to make room
for it.

The six dimensions are: **grammar**, **nav treatment**, **hero device**,
**act-sequence shape**, **close pattern**, **signature move**.

Dimension 6 is free, because a signature move is unique by definition. So the
gate really asks for three more out of the remaining five, and a build that
changes only grammar and world will fail it.

---

## The registry

| Build | Grammar | Nav treatment | Hero device | Act-sequence shape | Close pattern | Signature move | World | Port |
|---|---|---|---|---|---|---|---|---|

*(empty: your first build has nothing to clear, so build whatever the interview
points at. From the second onwards, this table is the constraint.)*

---

## What is taken

Add a bullet here whenever a build claims something a later build should avoid
reusing: a grammar, a nav treatment, a close pattern, a signature move, an
act-count-and-length band. The shared columns are what the next build inherits
as a constraint, so writing them down is the whole point.

Nothing is taken yet.

---

## Appending a row

After shipping, add one line to the table and one bullet to **What is taken** if
the build claimed something new. Fill every column. Say what the build shares
with existing rows.

Rows are append-only. A build that has been superseded stays in the table,
because the space it occupies is still occupied.

---

## Worked example

The skill's author kept a registry of twelve builds across eight page grammars.
If you want to see what a filled-in table looks like, and which shapes tend to
collide, read `EXAMPLES.md` in the scroll-craft repository. Treat it as
illustration only: those rows are somebody else's builds and they do **not**
constrain yours.
| ipr-rota (IPR Estacas, multipágina) | Rota de cravação (nova): cada página é uma camada do solo | Régua de profundidade fixa com as 8 estações, clicável; no celular, barra de descida sob o menu | Prancha azul com a maquete 3D em rascunho ao vivo e grade técnica com mira em mm | 8 páginas encadeadas; home: capa ao vivo, lista técnica, cravação por rolagem (pico, maior espaço), diferenciais, geometrias, processo em abas, clientes, chamada, passagem | Cada página fecha numa passagem para a próxima camada; o Contato resolve com "nega atingida" e o registro das camadas | A estaca que atravessa o site: a profundidade continua entre páginas e cada camada atravessada fica marcada | Desenho técnico (prancha azul e grafite) | Site estático, Vercel |
| ipr-jornada (IPR Estacas, multipágina, substitui ipr-rota) | Linha de produção (nova): cada página é uma estação do processo, com o tom do seu material | Linha de 1 px no pé do cabeçalho com 8 marcas (atual em amarelo); no celular, menu com amostra de cor por etapa | Título editorial sobre o tom de cimento e foto real da pista em painel que abre até as bordas com a rolagem | 8 páginas; home: abertura, números, fábrica, linha de produção horizontal fixada (tom muda por estação), cravação por rolagem (pico, 460vh), geometrias, clientes, passagem | A passagem é a capa da próxima página (mesmo título, foto e tom); o Contato fecha à noite com o registro das 8 amostras de material | Protensão entre páginas: fios com folga se tensionam ao fim da página e são cortados a partir do centro na capa seguinte, costurados por view transitions | Fotografia documental real, gradada como série (Higgsfield preparado por nome de cena) | Site estático, Vercel |

- Tomado por ipr-jornada: gramática "linha de produção" com tom de material por trecho; passagem que replica a capa da página seguinte; fios de protensão tensionados e liberados entre páginas. Compartilha com ipr-rota o pico na cravação por rolagem e o fecho no Contato com a nega (4 de 6 dimensões diferentes: gramática, navegação, abertura e assinatura).
