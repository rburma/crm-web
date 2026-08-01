/* COMPRAR NA LOJA MAIS PROXIMA — widget p/ paginas de produto do e-commerce
 * (Magento). Le produto/cor/tamanho da propria pagina + dados do cliente
 * logado (data-nome/email/telefone, preenchidos pelo template) e abre o CRM
 * (contactcenter.com.br/comprar) com tudo pronto — minimo de digitacao.
 *
 * USO (colar no template da pagina de produto):
 *   <div id="wt-comprar-loja"></div>
 *   <script src="https://contactcenter.com.br/comprar-widget.js"
 *     data-marca="wt" data-nome="" data-email="" data-telefone=""></script>
 *
 * Opcoes (atributos data- na tag <script>):
 *   data-marca     slug da marca no CRM (wt, t1, fs, ...)  [obrigatorio]
 *   data-botoes    "atendimento,whatsapp" (padrao: os dois) | so um deles
 *   data-cor       cor de fundo do botao de atendimento (padrao #111827)
 *   data-texto-atendimento / data-texto-whatsapp  textos dos botoes
 *   data-destino   id do elemento onde renderizar (padrao wt-comprar-loja;
 *                  sem o elemento, renderiza logo apos a tag do script)
 *   data-base      host do CRM (padrao https://contactcenter.com.br)
 */
(function () {
  var script = document.currentScript;
  if (!script) return;
  var d = function (k, padrao) { return script.getAttribute("data-" + k) || padrao || ""; };
  var BASE = d("base", "https://contactcenter.com.br").replace(/\/$/, "");
  var MARCA = d("marca", "wt");

  function texto(el) { return el && el.textContent ? el.textContent.trim() : ""; }

  // ── Produto: JSON-LD -> h1 -> <title> ──────────────────────────────
  function nomeProduto() {
    var lds = document.querySelectorAll('script[type="application/ld+json"]');
    for (var i = 0; i < lds.length; i++) {
      try {
        var j = JSON.parse(lds[i].textContent);
        var itens = Array.isArray(j) ? j : [j];
        for (var k = 0; k < itens.length; k++) {
          if (itens[k] && itens[k]["@type"] === "Product" && itens[k].name) return itens[k].name;
        }
      } catch (e) { /* proximo */ }
    }
    return texto(document.querySelector("h1")) || (document.title || "").split(" - ")[0];
  }
  function precoProduto() {
    var lds = document.querySelectorAll('script[type="application/ld+json"]');
    for (var i = 0; i < lds.length; i++) {
      try {
        var j = JSON.parse(lds[i].textContent);
        var itens = Array.isArray(j) ? j : [j];
        for (var k = 0; k < itens.length; k++) {
          var of = itens[k] && itens[k].offers;
          if (of) { var o1 = Array.isArray(of) ? of[0] : of; if (o1 && o1.price) return String(o1.price); }
        }
      } catch (e) { /* proximo */ }
    }
    try {
      var dl = window.dataLayer || [];
      for (var m = 0; m < dl.length; m++) {
        var it = dl[m] && dl[m].ecommerce && dl[m].ecommerce.items && dl[m].ecommerce.items[0];
        if (it && it.price) return String(it.price);
      }
    } catch (e) { /* sem preco */ }
    return "";
  }
  function marcaProduto() {
    try {
      var dl = window.dataLayer || [];
      for (var m = 0; m < dl.length; m++) {
        var it = dl[m] && dl[m].ecommerce && dl[m].ecommerce.items && dl[m].ecommerce.items[0];
        if (it && it.item_brand) return String(it.item_brand);
      }
    } catch (e) { /* segue */ }
    return "";
  }

  // ── Cor/Tamanho: selects super_attribute (Magento 1) + swatches (M2) ──
  function opcoesDe(sel) {
    var ops = [];
    for (var i = 0; i < sel.options.length; i++) {
      var t = (sel.options[i].text || "").trim();
      if (t && !/^escolha/i.test(t) && sel.options[i].value !== "") ops.push(t);
    }
    return ops;
  }
  function variacoes() {
    var cor = "", tam = "", cores = [], tams = [];
    var sels = document.querySelectorAll('select[name^="super_attribute"]');
    for (var i = 0; i < sels.length; i++) {
      var ops = opcoesDe(sels[i]);
      if (!ops.length) continue;
      var numericas = 0;
      for (var k = 0; k < ops.length; k++) if (/^\d+([.,]\d+)?$/.test(ops[k])) numericas++;
      var ehTam = numericas >= ops.length / 2;   // maioria numerica = tamanho
      var selTxt = sels[i].selectedIndex > 0 ? (sels[i].options[sels[i].selectedIndex].text || "").trim() : "";
      if (ehTam) { tams = ops; if (selTxt) tam = selTxt; }
      else { cores = ops; if (selTxt) cor = selTxt; }
    }
    // fallback Magento 2 (swatches)
    var sws = document.querySelectorAll(".swatch-attribute");
    for (var s = 0; s < sws.length; s++) {
      var code = (sws[s].getAttribute("data-attribute-code") || sws[s].getAttribute("attribute-code") || "").toLowerCase();
      var selecionado = sws[s].querySelector(".swatch-option.selected");
      var rotulo = selecionado
        ? (selecionado.getAttribute("data-option-label") || selecionado.getAttribute("aria-label") || texto(selecionado))
        : "";
      if (/size|tamanho/.test(code) && rotulo) tam = tam || rotulo;
      if (/color|cor/.test(code) && rotulo) cor = cor || rotulo;
    }
    return { cor: cor, tam: tam, cores: cores, tams: tams };
  }

  function montarUrl(modo) {
    var v = variacoes();
    var q = new URLSearchParams();
    q.set("m", MARCA);
    q.set("modo", modo);
    q.set("produto", nomeProduto().slice(0, 160));
    var mp = marcaProduto(); if (mp) q.set("marca", mp);
    if (v.cor) q.set("cor", v.cor); else if (v.cores.length) q.set("cores", v.cores.join("|"));
    if (v.tam) q.set("tam", v.tam); else if (v.tams.length) q.set("tamanhos", v.tams.join("|"));
    var pr = precoProduto(); if (pr) q.set("preco", "R$ " + pr);
    q.set("url", (location.href || "").split("#")[0].slice(0, 500));
    var nome = d("nome"), email = d("email"), tel = d("telefone");
    if (nome) q.set("nome", nome.slice(0, 160));
    if (email) q.set("email", email.slice(0, 255));
    if (tel) q.set("tel", tel.slice(0, 20));
    return BASE + "/comprar?" + q.toString();
  }

  // ── Botoes ─────────────────────────────────────────────────────────
  var corBtn = d("cor", "#111827");
  var quer = d("botoes", "atendimento,whatsapp").toLowerCase();
  var caixa = document.createElement("div");
  caixa.style.cssText = "display:flex;flex-direction:column;gap:8px;margin:12px 0;max-width:420px;";

  function botao(txt, fundo, modo) {
    var b = document.createElement("a");
    b.href = "#";
    b.textContent = txt;
    b.style.cssText =
      "display:block;text-align:center;padding:13px 18px;border-radius:10px;" +
      "font-weight:700;font-size:15px;text-decoration:none;color:#fff;" +
      "background:" + fundo + ";cursor:pointer;line-height:1.2;";
    b.addEventListener("click", function (ev) {
      ev.preventDefault();
      window.open(montarUrl(modo), "_blank");  // URL montada NO CLIQUE (pega cor/tam ja escolhidos)
    });
    return b;
  }

  if (quer.indexOf("atendimento") >= 0) {
    caixa.appendChild(botao(d("texto-atendimento", "🛍 Comprar na loja mais próxima"), corBtn, "atendimento"));
  }
  if (quer.indexOf("whatsapp") >= 0) {
    caixa.appendChild(botao(d("texto-whatsapp", "💬 Comprar pelo WhatsApp da loja"), "#16a34a", "whatsapp"));
  }

  var destino = document.getElementById(d("destino", "wt-comprar-loja"));
  if (destino) destino.appendChild(caixa);
  else if (script.parentNode) script.parentNode.insertBefore(caixa, script.nextSibling);
})();
