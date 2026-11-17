/* =========================================================
   Formulário "Falar com um especialista" — modal em 3 etapas
   (Figma: etapa 1 = 72:388 · etapa 2 = 72:389 · etapa 3 = 72:390 · obrigado = 72:391)
   - Abre por qualquer botão com [data-lead]
   - O fundo continua animando, só que desfocado (backdrop-filter)
   - Validação em tempo real: ✓ quando válido, erro após sair do campo
   - Etapa 2: "Outro" abre campo extra; "Ainda não possuo empresa" libera a empresa
   - Etapa 3: mercados com múltipla escolha, contador 0/500, aceite obrigatório
   Envio: configure CFG.endpoint (URL que recebe um POST em JSON).
   ========================================================= */
(function () {
  "use strict";

  var CFG = {
    endpoint: null,     // ex.: "https://seu-backend.com/leads" — enquanto for null, só mostra o obrigado
    whatsapp: null      // ex.: "5511999999999" — número oficial da BetLogic para o botão do obrigado
  };

  var root = document.querySelector(".leadform");
  if (!root) return;
  var modal = root.querySelector(".lead__modal");
  var form = root.querySelector("form");
  var html = document.documentElement;
  var backBtn = root.querySelector("[data-lead-back]");
  var nextBtn = root.querySelector(".lead__next");
  var nextLabel = root.querySelector("[data-next-label]");
  var lastFocus = null, closeTimer = 0, step = 1;
  var TOTAL = 3, DONE = 4;

  /* ---------- Abrir / fechar ---------- */
  function open(trigger) {
    clearTimeout(closeTimer);
    if (step === DONE) reset();               // depois do obrigado, recomeça do zero
    lastFocus = trigger || document.activeElement;
    root.hidden = false;
    void root.offsetWidth;
    root.classList.add("is-open");
    html.classList.add("lead-open");
    if (window.lenis) window.lenis.stop();
    setTimeout(function () { focusFirst(); }, 380);
  }
  function close() {
    root.classList.remove("is-open");
    html.classList.remove("lead-open");
    if (window.lenis) window.lenis.start();
    closeTimer = setTimeout(function () { root.hidden = true; }, 520);
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  }
  function focusFirst() {
    var el = root.querySelector('[data-step="' + step + '"] .field__input:not(:disabled), [data-step="' + step + '"] input, [data-step="' + step + '"] .lead__btn');
    if (el) el.focus({ preventScroll: true });
  }

  document.addEventListener("click", function (e) {
    var t = e.target.closest("[data-lead]");
    if (t) { e.preventDefault(); open(t); return; }
    if (e.target.closest("[data-lead-close]")) close();
  });
  document.addEventListener("keydown", function (e) {
    if (root.hidden) return;
    if (e.key === "Escape") { close(); return; }
    if (e.key !== "Tab") return;
    var f = [].slice.call(modal.querySelectorAll("button, input, select, textarea, a[href]"))
      .filter(function (el) { return !el.disabled && el.offsetParent !== null; });
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  /* ---------- Regras dos campos de texto ---------- */
  var ddi = root.querySelector("#lead-ddi");
  var noCompany = root.querySelector('input[name="noCompany"]');
  var RULES = {
    name: function (v) {
      return v.trim().split(/\s+/).filter(function (p) { return /^[A-Za-zÀ-ÿ'´`-]{2,}$/.test(p); }).length >= 2;
    },
    email: function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()); },
    phone: function (v) {
      var d = v.replace(/\D/g, "");
      if (ddi.value === "55") return (d.length === 10 || d.length === 11) && +d.slice(0, 2) >= 11;
      return d.length >= 6 && d.length <= 14;
    },
    roleOther: function (v) { return v.trim().length >= 2; },
    company: function (v) { return noCompany.checked || v.trim().length >= 2; },
    about: function (v) { return v.trim().length >= 10; }
  };

  function maskBR(d) {
    d = d.slice(0, 11);
    if (d.length <= 2) return d.length ? "(" + d : "";
    if (d.length <= 6) return "(" + d.slice(0, 2) + ") " + d.slice(2);
    if (d.length <= 10) return "(" + d.slice(0, 2) + ") " + d.slice(2, 6) + "-" + d.slice(6);
    return "(" + d.slice(0, 2) + ") " + d.slice(2, 7) + "-" + d.slice(7);
  }

  function isActive(el) { return !el.closest("[hidden]"); }

  function checkField(fieldEl, showError) {
    var input = fieldEl.querySelector(".field__input");
    var ok = RULES[fieldEl.dataset.field](input.value);
    fieldEl.classList.toggle("is-valid", ok && !input.disabled);
    if (showError || fieldEl.dataset.touched) {
      fieldEl.classList.toggle("is-invalid", !ok);
      input.setAttribute("aria-invalid", ok ? "false" : "true");
    }
    return ok;
  }

  function checkGroup(groupEl, showError) {
    var inputs = groupEl.querySelectorAll(":scope > .opts input, :scope > .sols input, :scope > .check input");
    var ok = [].some.call(inputs, function (i) { return i.checked; });
    if (showError || groupEl.dataset.touched) groupEl.classList.toggle("is-invalid", !ok);
    return ok;
  }

  root.querySelectorAll(".field[data-field]").forEach(function (fieldEl) {
    var input = fieldEl.querySelector(".field__input");
    input.addEventListener("input", function () {
      if (fieldEl.dataset.field === "phone" && ddi.value === "55") input.value = maskBR(input.value.replace(/\D/g, ""));
      if (fieldEl.dataset.field === "about") root.querySelector("[data-count]").textContent = input.value.length;
      checkField(fieldEl);
    });
    input.addEventListener("blur", function () {
      if (input.value.trim()) fieldEl.dataset.touched = "1";
      checkField(fieldEl);
    });
  });

  root.querySelectorAll(".group").forEach(function (groupEl) {
    groupEl.addEventListener("change", function (e) {
      if (e.target.closest(".field--sub")) return;
      groupEl.dataset.touched = "1";
      checkGroup(groupEl);
      toggleConditionals();
    });
  });

  ddi.addEventListener("change", function () {
    var phone = root.querySelector("#lead-phone");
    var d = phone.value.replace(/\D/g, "");
    phone.value = ddi.value === "55" ? maskBR(d) : d;
    phone.placeholder = ddi.value === "55" ? "(11) 99999-9999" : "Número com código de área";
    checkField(phone.closest(".field"));
  });

  // "Ainda não possuo empresa" → desativa e libera o campo
  noCompany.addEventListener("change", function () {
    var company = root.querySelector("#lead-company");
    company.disabled = noCompany.checked;
    if (noCompany.checked) company.value = "";
    var f = company.closest(".field");
    f.classList.remove("is-invalid");
    checkField(f);
  });

  // campos que dependem de outra resposta (data-when="role=Outro")
  function toggleConditionals() {
    root.querySelectorAll("[data-when]").forEach(function (el) {
      var parts = el.dataset.when.split("=");
      var sel = root.querySelector('input[name="' + parts[0] + '"]:checked');
      var show = !!sel && sel.value === parts[1];
      el.hidden = !show;
      if (!show) {
        el.classList.remove("is-invalid", "is-valid");
        delete el.dataset.touched;
      }
    });
  }

  /* ---------- Etapas ---------- */
  function goTo(n) {
    var target = root.querySelector('[data-step="' + n + '"]');
    if (!target) return;
    root.querySelectorAll("[data-step]").forEach(function (s) { s.hidden = s !== target; });
    step = n;
    var done = n === DONE;
    root.classList.toggle("is-done", done);
    modal.style.setProperty("--lead-step", Math.min(n, TOTAL));
    root.querySelector("[data-step-count]").textContent = Math.min(n, TOTAL);
    root.querySelectorAll("[data-step-nav]").forEach(function (li) {
      var i = +li.dataset.stepNav;
      li.classList.toggle("is-current", !done && i === n);
      li.classList.toggle("is-done", done || i < n);
    });
    backBtn.hidden = n === 1 || done;
    var final = n === TOTAL;
    nextBtn.classList.toggle("is-final", final);
    nextLabel.textContent = final ? "Solicitar contato com especialista" : "Continuar";
    target.scrollTop = 0;
    focusFirst();
  }

  backBtn.addEventListener("click", function () { if (step > 1 && step <= TOTAL) goTo(step - 1); });

  function validateStep(n) {
    var sec = root.querySelector('[data-step="' + n + '"]');
    var results = [];
    sec.querySelectorAll(".field[data-field]").forEach(function (f) {
      if (!isActive(f)) return;
      f.dataset.touched = "1";
      results.push(checkField(f, true));
    });
    sec.querySelectorAll(".group").forEach(function (g) {
      if (!isActive(g)) return;
      g.dataset.touched = "1";
      results.push(checkGroup(g, true));
    });
    return results.every(Boolean);
  }

  function collect() {
    var data = {};
    new FormData(form).forEach(function (v, k) {
      if (data[k] !== undefined) data[k] = [].concat(data[k], v);
      else data[k] = v;
    });
    data.ddi = "+" + ddi.value;
    data.marketing = !!data.marketing;
    data.privacy = !!data.privacy;
    data.noCompany = !!data.noCompany;
    if (data.markets && !Array.isArray(data.markets)) data.markets = [data.markets];
    data.page = location.href;
    data.sentAt = new Date().toISOString();
    return data;
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (step > TOTAL) return;
    if (!validateStep(step)) {
      var bad = root.querySelector('[data-step="' + step + '"] .is-invalid');
      if (bad) {
        bad.scrollIntoView({ block: "center", behavior: "smooth" });
        var inp = bad.querySelector(".field__input, input");
        if (inp) inp.focus({ preventScroll: true });
      }
      return;
    }
    if (step < TOTAL) { goTo(step + 1); return; }

    // envio final
    var data = collect();
    window.BLLead = { data: data };
    nextBtn.disabled = true;
    var send = CFG.endpoint
      ? fetch(CFG.endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) })
      : Promise.resolve();
    send.catch(function (err) { console.warn("Falha ao enviar o formulário:", err); })
      .then(function () {
        nextBtn.disabled = false;
        goTo(DONE);
      });
  });

  // botão do obrigado → WhatsApp oficial (quando configurado)
  var wa = root.querySelector("[data-whatsapp]");
  if (wa && CFG.whatsapp) wa.href = "https://wa.me/" + CFG.whatsapp;

  /* ---------- Recomeçar ---------- */
  function reset() {
    form.reset();
    root.querySelectorAll(".field, .group").forEach(function (el) {
      el.classList.remove("is-valid", "is-invalid");
      delete el.dataset.touched;
    });
    root.querySelector("#lead-company").disabled = false;
    root.querySelector("[data-count]").textContent = "0";
    toggleConditionals();
    goTo(1);
  }

  toggleConditionals();
  modal.style.setProperty("--lead-step", 1);
})();
