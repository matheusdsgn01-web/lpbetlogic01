/* =========================================================
   BetLogic — interações
   1) Textos: cada linha sobe de dentro de uma máscara (line reveal)
   2) Cards/blocos: sobem e aparecem
   Hero anima ao abrir a página; o resto ao entrar na tela.
   ========================================================= */
(function () {
  "use strict";

  var root = document.documentElement;
  var DUR = 0.9;          // deve bater com --reveal-dur (s)
  var LINE_STEP = 0.08;   // deve bater com --line-step (s)
  var STAGGER = 0.08;     // atraso entre irmãos (cards) (s)
  var MAX_DELAY = 0.4;

  /* ---------- O que anima ---------- */
  var HERO_TEXT = [".hero__title", ".hero__lead"];
  var HERO_BLOCK = [".hero__cta", ".hero__ring"];

  var TEXT = [
    ".sec-head h2", ".sec-head .lead",
    ".intel h2",
    ".banner__title",
    ".markets h2", ".markets .lead",
    ".cta h2", ".cta .lead",
    ".feature h3", ".feature p",
    ".product h3", ".product p",
    ".icard h3", ".icard__head p"
  ];
  var BLOCK = [
    ".feature", ".product", ".icard",
    ".banner__side",
    ".markets__globe-wrap", ".region",
    ".cta__logo", ".cta__btn"
  ];

  function $$(sels) {
    var out = [];
    sels.forEach(function (s) {
      document.querySelectorAll(s).forEach(function (el) {
        if (out.indexOf(el) === -1) out.push(el);
      });
    });
    return out;
  }

  /* ---------- Divisão em linhas ---------- */
  function tokenize(el) {
    var tokens = [];
    var pendingSpace = false;
    (function walk(node, chain) {
      node.childNodes.forEach(function (child) {
        if (child.nodeType === 3) {
          child.textContent.split(/(\s+)/).forEach(function (part) {
            if (!part) return;
            if (/^\s+$/.test(part)) { pendingSpace = true; return; }
            tokens.push({ text: part, chain: chain, space: pendingSpace });
            pendingSpace = false;
          });
        } else if (child.nodeName === "BR") {
          tokens.push({ br: true });
          pendingSpace = false;
        } else if (child.nodeType === 1) {
          walk(child, chain.concat(child));
        }
      });
    })(el, []);
    return tokens;
  }

  function buildChain(chain, text) {
    if (!chain.length) return { node: document.createTextNode(text), leaf: null };
    var top = chain[0].cloneNode(false), cur = top;
    for (var i = 1; i < chain.length; i++) {
      var c = chain[i].cloneNode(false);
      cur.appendChild(c);
      cur = c;
    }
    cur.textContent = text;
    return { node: top, leaf: cur };
  }

  function split(el) {
    if (!el.__original) el.__original = el.innerHTML;
    el.innerHTML = el.__original;
    var tokens = tokenize(el);

    // 1) render palavra por palavra para medir
    el.innerHTML = "";
    var wordEls = [];
    tokens.forEach(function (t) {
      if (t.br) { el.appendChild(document.createElement("br")); return; }
      if (t.space) el.appendChild(document.createTextNode(" "));
      var w = document.createElement("span");
      w.appendChild(buildChain(t.chain, t.text).node);
      el.appendChild(w);
      t.el = w;
      wordEls.push(w);
    });

    // 2) agrupar por linha visual
    var lines = [], lastTop = null;
    tokens.forEach(function (t) {
      if (t.br) { lastTop = null; return; }
      var top = Math.round(t.el.offsetTop);
      if (lastTop === null || Math.abs(top - lastTop) > 4) { lines.push([]); lastTop = top; }
      lines[lines.length - 1].push(t);
    });

    // 3) reconstruir: .line (máscara) > .line__in (o que sobe)
    var cs = getComputedStyle(el);
    var selfGrad = el.__selfGrad || (cs.webkitBackgroundClip || cs.backgroundClip) === "text";
    var gradImage = el.__gradImage || cs.backgroundImage;
    if (selfGrad) {
      // o degradê passa para cada linha; o elemento fica sem fundo durante a animação
      el.__selfGrad = true;
      el.__gradImage = gradImage;
      el.style.backgroundImage = "none";
    }
    el.innerHTML = "";
    lines.forEach(function (lineTokens, i) {
      var line = document.createElement("span");
      line.className = "line";
      var inner = document.createElement("span");
      inner.className = "line__in";
      inner.style.setProperty("--i", i);
      if (selfGrad) {
        inner.style.backgroundImage = gradImage;
        inner.style.webkitBackgroundClip = "text";
        inner.style.backgroundClip = "text";
        inner.style.color = "transparent";
      }
      var prevChain = null, prevLeaf = null;
      lineTokens.forEach(function (t, j) {
        var space = t.space && j > 0;
        var same = prevChain && t.chain.length && t.chain.length === prevChain.length &&
          t.chain.every(function (n, k) { return n === prevChain[k]; });
        if (same) {
          prevLeaf.textContent += (space ? " " : "") + t.text;
        } else if (!t.chain.length && prevChain && !prevChain.length) {
          inner.appendChild(document.createTextNode((space ? " " : "") + t.text));
        } else {
          if (space) inner.appendChild(document.createTextNode(" "));
          var b = buildChain(t.chain, t.text);
          inner.appendChild(b.node);
          prevLeaf = b.leaf;
        }
        prevChain = t.chain;
      });
      line.appendChild(inner);
      el.appendChild(line);
    });
    el.__lines = lines.length;
  }

  // Depois que a animação termina, devolve o HTML original
  // (assim o texto volta a quebrar normalmente se a janela mudar de tamanho)
  function restoreLater(el) {
    var delay = parseFloat(getComputedStyle(el).getPropertyValue("--reveal-delay")) || 0;
    var total = (delay + (el.__lines || 1) * LINE_STEP + DUR) * 1000 + 150;
    setTimeout(function () {
      el.innerHTML = el.__original;
      if (el.__selfGrad) el.style.backgroundImage = "";
      el.classList.add("is-done");
    }, total);
  }

  function show(el) {
    el.classList.add("is-visible");
    if (el.hasAttribute("data-split")) restoreLater(el);
  }

  /* ---------- Atrasos ---------- */
  function staggerSiblings(els) {
    var groups = new Map();
    els.forEach(function (el) {
      var p = el.parentElement;
      if (!groups.has(p)) groups.set(p, []);
      groups.get(p).push(el);
    });
    groups.forEach(function (items) {
      if (items.length < 2) return;
      items.forEach(function (el, i) {
        el.style.setProperty("--reveal-delay", Math.min(i * STAGGER, MAX_DELAY) + "s");
      });
    });
  }

  /* ---------- Início ---------- */
  function init() {
    var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    var heroText = $$(HERO_TEXT), heroBlock = $$(HERO_BLOCK);
    var text = $$(TEXT), block = $$(BLOCK);
    var allText = heroText.concat(text), allBlock = heroBlock.concat(block);

    root.classList.add("reveal-prep");
    allText.forEach(function (el) { el.setAttribute("data-split", ""); });
    allBlock.forEach(function (el) { el.setAttribute("data-reveal", ""); });

    if (reduce || !("IntersectionObserver" in window)) {
      root.classList.remove("reveal-prep");
      root.classList.add("reveal-ready");
      allText.concat(allBlock).forEach(function (el) { el.classList.add("is-visible"); });
      return;
    }

    // atrasos: cards em sequência; texto de dentro do card entra logo depois do card
    staggerSiblings(block);
    staggerSiblings(text);
    text.forEach(function (el) {
      var card = el.closest("[data-reveal]");
      if (card) {
        var d = parseFloat(card.style.getPropertyValue("--reveal-delay")) || 0;
        var own = parseFloat(el.style.getPropertyValue("--reveal-delay")) || 0;
        el.style.setProperty("--reveal-delay", (d + own + 0.12).toFixed(2) + "s");
      }
    });

    // Hero: título → texto → botão → anel
    heroText.forEach(function (el, i) { el.style.setProperty("--reveal-delay", (0.1 + i * 0.25) + "s"); });
    heroBlock.forEach(function (el, i) { el.style.setProperty("--reveal-delay", (0.55 + i * 0.15) + "s"); });

    allText.forEach(split);
    void document.body.offsetHeight;          // aplica o estado escondido já
    root.classList.remove("reveal-prep");
    root.classList.add("reveal-ready");

    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        heroText.concat(heroBlock).forEach(show);
      });
    });

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          show(entry.target);
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: "0px 0px -10% 0px", threshold: 0.15 });
    text.concat(block).forEach(function (el) {
      // a seção Mercados é revelada pela transição (quando o azul fecha a tela)
      if (el.closest(".markets")) return;
      io.observe(el);
    });

    window.BLReveal = function (scope) {
      scope.querySelectorAll("[data-split], [data-reveal]").forEach(function (el) {
        if (!el.classList.contains("is-visible")) show(el);
      });
    };
    if (window.__blPendingReveal) window.BLReveal(window.__blPendingReveal);

    // Se a janela mudar antes de o texto aparecer, refaz as linhas
    var t;
    window.addEventListener("resize", function () {
      clearTimeout(t);
      t = setTimeout(function () {
        allText.forEach(function (el) {
          if (!el.classList.contains("is-visible")) split(el);
        });
      }, 150);
    });
  }

  var started = false;
  function start() { if (!started) { started = true; init(); } }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(start);
  setTimeout(start, 1500); // segurança caso as fontes demorem
})();

/* =========================================================
   Cards da Seção 2 no toque (mobile não tem hover):
   tocar ativa o card (.is-active); tocar em outro troca.
   ========================================================= */
(function () {
  "use strict";
  var cards = document.querySelectorAll(".feature");
  cards.forEach(function (card) {
    card.addEventListener("pointerup", function (e) {
      if (e.pointerType === "mouse") return;   // no desktop o :hover já resolve
      cards.forEach(function (c) { if (c !== card) c.classList.remove("is-active"); });
      card.classList.add("is-active");
    });
  });
})();

/* =========================================================
   Produtos no celular/tablet: cards empilhados.
   Conforme o próximo card cobre o atual, o de baixo diminui e escurece.
   ========================================================= */
(function () {
  "use strict";
  var mq = window.matchMedia("(max-width: 960px)");
  var cards = [].slice.call(document.querySelectorAll(".product"));
  if (cards.length < 2) return;
  var ticking = false;

  function update() {
    ticking = false;
    if (!mq.matches) {
      cards.forEach(function (c) { c.style.removeProperty("--stack"); });
      return;
    }
    cards.forEach(function (card, i) {
      var next = cards[i + 1];
      if (!next) { card.style.setProperty("--stack", 0); return; }
      var a = card.getBoundingClientRect(), b = next.getBoundingClientRect();
      // 0 = próximo card ainda longe · 1 = próximo card cobriu este
      var p = 1 - (b.top - a.top) / a.height;
      p = Math.max(0, Math.min(1, p));
      card.style.setProperty("--stack", p.toFixed(3));
    });
  }
  function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(update); } }
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);
  update();
})();

/* =========================================================
   Transição: a logo gira e cresce com a rolagem,
   e a cor dela preenche a tela até a seção Mercados
   ========================================================= */
(function () {
  "use strict";

  var section = document.querySelector(".transition");
  if (!section) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  var logo = section.querySelector(".transition__logo");
  var fill = section.querySelector(".transition__fill");
  var markets = document.querySelector(".markets");
  var revealed = false;
  var HOLE = 0.39;       // diâmetro do furo central / diâmetro da logo
  var TURN = 300;        // graus de rotação no total
  var ticking = false;

  function clamp(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function easeInOut(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function easeIn(t) { return t * t; }

  function update() {
    ticking = false;
    var vw = window.innerWidth, vh = window.innerHeight;
    var rect = section.getBoundingClientRect();
    var dist = section.offsetHeight - vh;
    var p = clamp(-rect.top / dist);

    var base = parseFloat(getComputedStyle(section).getPropertyValue("--logo-base")) || 396.5;
    var halfDiag = Math.sqrt(vw * vw + vh * vh) / 2;

    // logo: do tamanho original até a borda dela passar dos cantos da tela
    var e = easeInOut(p);
    var maxSize = halfDiag * 2.3;
    var size = base + (maxSize - base) * e;
    logo.style.width = size.toFixed(1) + "px";       // largura (não scale) = vetor sempre nítido
    logo.style.transform = "translate(-50%, -50%) rotate(" + (TURN * e).toFixed(2) + "deg)";

    // cor da logo: nasce no furo do centro e se espalha até cobrir tudo
    var f = clamp((p - 0.15) / 0.65);          // tela toda azul em p = 0.8
    var d = easeIn(f) * halfDiag * 2.1;
    fill.style.width = fill.style.height = d.toFixed(1) + "px";

    // Mercados (que já vem subindo por cima) aparece quando o azul fecha a tela
    if (markets) {
      var m = clamp((p - 0.8) / 0.12);
      markets.style.opacity = m.toFixed(3);
      if (m > 0 && !revealed) {
        revealed = true;
        if (window.BLReveal) window.BLReveal(markets);
        else window.__blPendingReveal = markets;
      }
    }

    // fundo claro só enquanto a cor ainda não chegou na parte de baixo da tela
    section.setAttribute("data-bg", d / 2 < vh / 2 - 40 ? "light" : "dark");
  }

  function onScroll() {
    if (!ticking) { ticking = true; requestAnimationFrame(update); }
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);
  update();
})();

/* =========================================================
   Botão fixo: aparece quando o Hero sai da tela
   e troca para a versão escura sobre fundos claros
   ========================================================= */
(function () {
  "use strict";

  var float = document.querySelector(".float-cta");
  var hero = document.querySelector(".hero");
  if (!float || !hero) return;
  var link = float.querySelector("a");
  var ticking = false;

  function update() {
    ticking = false;
    var vh = window.innerHeight;

    // mostra quando o Hero já saiu (a 2ª seção ocupa mais da metade da tela)
    var shown = hero.getBoundingClientRect().bottom < vh * 0.5;
    // ...e some quando o botão do CTA final já está na tela (evita botão duplicado
    // e evita cobrir os links do rodapé)
    var ctaBtn = document.querySelector(".cta__btn");
    if (ctaBtn && ctaBtn.getBoundingClientRect().top < vh - 40) shown = false;
    if (shown !== float.classList.contains("is-shown")) {
      float.classList.toggle("is-shown", shown);
      float.setAttribute("aria-hidden", shown ? "false" : "true");
      link.tabIndex = shown ? 0 : -1;
    }

    // o fundo atrás do centro do botão é claro?
    var r = float.getBoundingClientRect();
    var y = r.top + r.height / 2;
    var onLight = false;
    // consulta a cada quadro: a transição troca o próprio data-bg conforme escurece
    document.querySelectorAll("[data-bg='light']").forEach(function (sec) {
      var s = sec.getBoundingClientRect();
      if (y >= s.top && y <= s.bottom) onLight = true;
    });
    float.classList.toggle("is-on-light", onLight);
  }

  function onScroll() {
    if (!ticking) { ticking = true; requestAnimationFrame(update); }
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);
  update();
})();
