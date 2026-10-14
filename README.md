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
  img/, clientes/, docs/ fotos, logos de clientes e ábacos em PDF
build.py                 gera index.html e <pagina>/index.html
```

As URLs geradas mantêm as do site atual (`/estacas/`, `/fundacao/`, `/central-de-concreto/`,
`/controle-de-qualidade/`, `/clientes/`, `/perguntas-frequentes/`, `/contato/`).

## Editar e publicar

1. Edite os arquivos em `src/` (ou `assets/`).
2. Rode `python3 build.py`.
3. Visualize localmente: `python3 -m http.server` e abra http://localhost:8000.
4. Publique a raiz do repositório em qualquer hospedagem estática.

Para incluir/alterar uma estaca, edite `assets/js/estacas-data.js` e coloque o PDF em `assets/docs/`.

## Observações

- O formulário de contato não depende de servidor: monta a mensagem e abre o WhatsApp
  comercial ou o e-mail. Pode ser ligado a um serviço de formulários depois.
- O simulador de cravação da home é ilustrativo (camadas, golpes e nega fictícios).
