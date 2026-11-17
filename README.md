# BetLogic — Landing page

Landing page da BetLogic (tecnologia para operadores de iGaming).
Site estático em **HTML + CSS + JavaScript puro**, sem build: é só publicar a pasta.

## Estrutura

```
index.html            página única
css/styles.css        todos os estilos (tokens no :root, responsivo no final)
js/
  main.js             entradas de texto/cards, botão fixo, transição da logo, cards empilhados (mobile)
  smooth-scroll.js    scroll suave (Lenis)
  hero-wave.js        ondas em WebGL (Hero e CTA final)
  hero-ring.js        anel 3D girando no Hero (Three.js)
  globe.js            globo 3D interativo da seção Mercados (dados dos países no topo do arquivo)
  lead-form.js        formulário em 3 etapas "Falar com um especialista"
  vendor/             Three.js 0.160 e Lenis 1.1.13 (cópias locais, sem CDN)
assets/               imagens, ícones, bandeiras, texturas do globo
fonts/                Articulat CF (Light, Normal, Medium)
```

## Rodar localmente

Os módulos 3D precisam de um servidor (não abre direto pelo arquivo).
Qualquer servidor estático serve, por exemplo:

```bash
npx serve .
```

ou, no Windows, sem instalar nada:

```bash
powershell -ExecutionPolicy Bypass -File serve.ps1
```

e abra http://localhost:5173.

## Publicar

Funciona em qualquer hospedagem estática (Vercel, Netlify, GitHub Pages, Cloudflare Pages):
publique a raiz do repositório, sem comando de build.

## Antes de ir ao ar — pendências

- **Envio do formulário:** em `js/lead-form.js`, preencha `CFG.endpoint` com a URL que recebe os leads (POST em JSON).
  Enquanto estiver `null`, o formulário mostra a tela de obrigado mas **não envia** os dados.
- **WhatsApp:** em `js/lead-form.js`, preencha `CFG.whatsapp` (ex.: `5511999999999`) para o botão da tela de obrigado.
- **Links vazios:** Privacidade, Termos e "Política de Privacidade" (formulário) ainda apontam para `#`.
- **Fonte Articulat CF:** para uso na web é preciso a licença de webfont (Connary Fagen).

## Créditos

Design e desenvolvimento: [Matheus Toledo](https://www.instagram.com/matheustoledo.design/).
Texturas da Terra: NASA (domínio público). Fronteiras dos países: Natural Earth (domínio público).
