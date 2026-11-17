/* =========================================================
   Hero — onda em WebGL
   - A imagem fica parada; os pixels são deslocados por ondas
     suaves → as linhas ondulam por dentro da moldura.
   - Um brilho passa ao longo das linhas reforçando só os pontos
     que já são claros (o fundo escuro não muda, não há "faixa").
   Ajustes rápidos: objeto CFG abaixo.
   ========================================================= */
(function () {
  "use strict";

  var CFG = {
    amp: 0.013,        // ondulação principal (fração da altura ≈ 11px)
    amp2: 0.005,       // ondulação fina
    speed: 0.55,       // velocidade das ondas
    glint: 0.85,       // força do brilho nos pontos claros
    glintSpeed: 0.42,  // velocidade do brilho (vai e volta)
    glintWidth: 0.2    // largura do brilho (fração da largura)
  };

  // Vale para toda onda marcada com [data-wave] (Hero e CTA final),
  // com a mesma velocidade, brilho e tom.
  document.querySelectorAll("[data-wave]").forEach(setup);

  function setup(wrap) {
  var canvas = wrap.querySelector("canvas");
  var img = wrap.querySelector("img");
  var gl = canvas.getContext("webgl2", { alpha: false, antialias: false, premultipliedAlpha: false }) ||
           canvas.getContext("webgl", { alpha: false, antialias: false, premultipliedAlpha: false });
  if (!gl) return; // fica a imagem estática
  var isGL2 = typeof WebGL2RenderingContext !== "undefined" && gl instanceof WebGL2RenderingContext;
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var VS = "attribute vec2 a; varying vec2 uv;" +
    "void main(){ uv = a * 0.5 + 0.5; gl_Position = vec4(a, 0.0, 1.0); }";

  var FS = "precision highp float;" +
    "varying vec2 uv; uniform sampler2D tex; uniform float t;" +
    "uniform float amp, amp2, glint, gpos, gw;" +
    "void main(){" +
    "  vec2 p = uv;" +
    // ondas que viajam ao longo das linhas; variam com y para as linhas não andarem juntas
    "  p.y += sin(uv.x * 5.5 + t * 0.9 + uv.y * 2.6) * amp;" +
    "  p.y += sin(uv.x * 13.0 - t * 1.3 + uv.y * 7.0) * amp2;" +
    "  p.x += sin(uv.y * 4.0 + t * 0.6) * amp2 * 0.6;" +
    "  vec3 c = texture2D(tex, p).rgb;" +
    // brilho: só onde já é claro (luminância alta), sem tocar o fundo
    "  float lum = dot(c, vec3(0.299, 0.587, 0.114));" +
    "  float band = exp(-pow((uv.x - gpos) / gw, 2.0));" +
    "  float hi = smoothstep(0.18, 0.75, lum);" +
    "  c += c * band * hi * glint;" +
    "  gl_FragColor = vec4(c, 1.0);" +
    "}";

  function shader(type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.warn(gl.getShaderInfoLog(s)); return null; }
    return s;
  }
  var vs = shader(gl.VERTEX_SHADER, VS), fs = shader(gl.FRAGMENT_SHADER, FS);
  if (!vs || !fs) return;
  var prog = gl.createProgram();
  gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
  gl.useProgram(prog);

  var buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  var loc = gl.getAttribLocation(prog, "a");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  var U = {};
  ["tex", "t", "amp", "amp2", "glint", "gpos", "gw"].forEach(function (n) { U[n] = gl.getUniformLocation(prog, n); });
  gl.uniform1i(U.tex, 0);
  gl.uniform1f(U.amp, CFG.amp);
  gl.uniform1f(U.amp2, CFG.amp2);
  gl.uniform1f(U.glint, CFG.glint);
  gl.uniform1f(U.gw, CFG.glintWidth);

  function resize() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = Math.round(wrap.offsetWidth * dpr), h = Math.round(wrap.offsetHeight * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w; canvas.height = h;
      gl.viewport(0, 0, w, h);
    }
  }

  var ready = false, visible = true, start = performance.now(), raf = 0;

  function draw(now) {
    var t = (now - start) / 1000;
    gl.uniform1f(U.t, reduce ? 0 : t * CFG.speed);
    // posição do brilho: vai e volta passando por toda a onda (-0.25 → 1.25)
    gl.uniform1f(U.gpos, reduce ? -1 : 0.5 + 0.75 * Math.sin(t * CFG.glintSpeed));
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
  function loop(now) {
    raf = 0;
    if (!ready || !visible) return;
    draw(now);
    if (!reduce) raf = requestAnimationFrame(loop);
  }
  function kick() { if (!raf && ready && visible) raf = requestAnimationFrame(loop); }

  function load() {
    var tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    if (isGL2) {
      // mipmaps evitam que as linhas finas "cintilem" quando reduzidas
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    } else {
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    }
    resize();
    ready = true;
    draw(performance.now());
    wrap.classList.add("is-gl");
    kick();
  }

  if (img.complete && img.naturalWidth) load();
  else img.addEventListener("load", load);

  // só anima quando o Hero está na tela
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (e) {
      visible = e[0].isIntersecting;
      kick();
    }).observe(wrap);
  }
  window.addEventListener("resize", function () { if (ready) { resize(); draw(performance.now()); } });
  }
})();
