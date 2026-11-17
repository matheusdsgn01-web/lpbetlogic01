/* =========================================================
   Scroll suave da página toda (Lenis)
   - A roda do mouse / trackpad desliza com inércia em vez de "pular".
   - No celular o toque continua nativo (já é suave).
   - Os links do menu (#produtos, #mercados…) rolam suave até a seção.
   Ajuste a sensação em LENIS_OPTS.
   ========================================================= */
(function () {
  "use strict";

  if (typeof window.Lenis !== "function") return;                       // sem a lib: scroll normal
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  var LENIS_OPTS = {
    lerp: 0.085,            // suavidade: menor = mais "deslizante" (0.06–0.12)
    wheelMultiplier: 0.95,  // distância por giro da roda
    smoothWheel: true,
    syncTouch: false
  };

  var lenis = new window.Lenis(LENIS_OPTS);
  window.lenis = lenis;

  function raf(time) {
    lenis.raf(time);
    requestAnimationFrame(raf);
  }
  requestAnimationFrame(raf);

  // Links internos: rola suave até a seção (descontando o header fixo)
  document.addEventListener("click", function (e) {
    var a = e.target.closest('a[href^="#"]');
    if (!a || a.hasAttribute("data-lead")) return;   // botões do formulário: quem cuida é o lead-form.js
    var id = a.getAttribute("href");
    e.preventDefault();
    if (id === "#") { lenis.scrollTo(0, { duration: 1.4 }); return; }
    var target = document.querySelector(id);
    if (!target) return;
    var offset = id === "#mercados" ? 0 : -60;    // Mercados já começa no topo da tela
    lenis.scrollTo(target, { offset: offset, duration: 1.4 });
  });
})();
