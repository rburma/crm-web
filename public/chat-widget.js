/* Widget de chat por marca — modos e opcoes:
 *   data-marca="SLUG" (obrigatorio)
 *   sem data-texto            = BALAO flutuante no canto
 *   data-texto="Fale conosco" = BOTAO inline (no lugar onde o script for colado)
 *   + data-estilo="campo"     = CAMPO de digitacao (input de verdade; digitar/clicar abre o chat)
 *   data-formato = pilula | quadrado | redondo   (formato do botao)
 *   data-cor="#16a34a" · data-tamanho = p|m|g|numero(px) · data-alerta="1" (badge pulsante)
 *   data-chat-titulo="..." · data-chat-saudacao="..." (personaliza a janela do chat) */
(function () {
  var s = document.currentScript;
  function attr(n, padrao) { return (s && s.getAttribute(n)) || padrao || ""; }
  var marca = attr("data-marca");
  var base = attr("data-base", "https://contactcenter.com.br");
  var cor = attr("data-cor", "#0f172a");
  var texto = attr("data-texto");
  var estilo = attr("data-estilo");
  var formato = attr("data-formato", "pilula");
  var alerta = attr("data-alerta") === "1";
  var tam = attr("data-tamanho", "m");
  if (!marca) return;
  var fonte = tam === "p" ? 13 : tam === "g" ? 18 : tam === "m" ? 15 : parseInt(tam, 10);
  if (!fonte || fonte < 11 || fonte > 40) fonte = 15;
  var pv = Math.round(fonte * 0.62), ph = Math.round(fonte * 1.5);
  var raio = formato === "quadrado" ? "10px" : "999px";

  if (!document.getElementById("wt-chat-css")) {
    var css = document.createElement("style");
    css.id = "wt-chat-css";
    css.textContent =
      "@keyframes wtdot{0%,55%,100%{opacity:.2;transform:translateY(0) scale(1)}25%{opacity:1;transform:translateY(-5px) scale(1.3)}}" +
      ".wt-dots{display:inline-flex;gap:4px;margin-left:9px;align-items:center}" +
      ".wt-dots i{width:7px;height:7px;border-radius:50%;background:currentColor;display:inline-block;animation:wtdot 1.1s infinite}" +
      ".wt-dots i:nth-child(2){animation-delay:.15s}.wt-dots i:nth-child(3){animation-delay:.3s}" +
      "@keyframes wtpulse{0%{box-shadow:0 0 0 0 rgba(220,38,38,.55)}70%{box-shadow:0 0 0 10px rgba(220,38,38,0)}100%{box-shadow:0 0 0 0 rgba(220,38,38,0)}}" +
      ".wt-badge{position:absolute;top:-6px;right:-6px;min-width:20px;height:20px;border-radius:50%;background:#dc2626;color:#fff;font:700 12px/20px system-ui;text-align:center;animation:wtpulse 1.6s infinite}" +
      ".wt-wrap{position:relative;display:inline-block}";
    document.head.appendChild(css);
  }
  function dots() {
    var d = document.createElement("span");
    d.className = "wt-dots";
    d.innerHTML = "<i></i><i></i><i></i>";
    return d;
  }
  function comBadge(el) {
    if (!alerta) return el;
    var w = document.createElement("span");
    w.className = "wt-wrap";
    var b = document.createElement("span");
    b.className = "wt-badge";
    b.textContent = "1";
    w.appendChild(el); w.appendChild(b);
    return w;
  }

  var box = document.getElementById("wt-chat-box");
  if (!box) {
    box = document.createElement("div");
    box.id = "wt-chat-box";
    box.style.cssText = "position:fixed;bottom:88px;right:20px;width:370px;max-width:calc(100vw - 32px);height:560px;max-height:calc(100vh - 120px);border-radius:14px;overflow:hidden;box-shadow:0 8px 30px rgba(0,0,0,.3);z-index:99999;display:none;background:#fff;";
    var frame = document.createElement("iframe");
    var qs = "?cor=" + encodeURIComponent(cor);
    if (attr("data-chat-titulo")) qs += "&titulo=" + encodeURIComponent(attr("data-chat-titulo"));
    if (attr("data-chat-saudacao")) qs += "&saudacao=" + encodeURIComponent(attr("data-chat-saudacao"));
    frame.src = base + "/embed/chat/" + encodeURIComponent(marca) + qs;
    frame.style.cssText = "width:100%;height:100%;border:0;";
    frame.setAttribute("title", "Chat com a loja");
    box.appendChild(frame);
    document.body.appendChild(box);
  }
  function abrir() { box.style.display = box.style.display === "none" ? "block" : "none"; }

  if (texto && estilo === "campo") {
    // CAMPO DE DIGITACAO real: focar/clicar/digitar abre a janela do chat.
    var wrap = document.createElement("span");
    wrap.style.cssText = "display:inline-flex;align-items:center;gap:8px;border:2px solid " + cor + ";border-radius:" + raio + ";background:#fff;padding:" + pv + "px " + ph + "px;max-width:100%;";
    var inp = document.createElement("input");
    inp.type = "text";
    inp.placeholder = texto;
    inp.style.cssText = "border:none;outline:none;background:transparent;font-size:" + fonte + "px;color:#334155;min-width:" + (fonte * 12) + "px;font-family:system-ui,sans-serif;";
    var ld = document.createElement("span");
    ld.style.cssText = "display:inline-flex;align-items:center;color:" + cor + ";";
    ld.appendChild(dots());
    wrap.appendChild(inp);
    wrap.appendChild(ld);
    function abreCampo() { abrir(); inp.blur(); inp.value = ""; }
    inp.addEventListener("focus", abreCampo);
    inp.addEventListener("keydown", abreCampo);
    wrap.addEventListener("click", abreCampo);
    var elc = comBadge(wrap);
    if (s && s.parentNode) s.parentNode.insertBefore(elc, s);
    else document.body.appendChild(elc);
    return;
  }

  if (texto) {
    // BOTAO inline (pilula/quadrado/redondo) com pontinhos animados
    var b = document.createElement("button");
    b.type = "button";
    if (formato === "redondo") {
      var d2 = Math.round(fonte * 3.4);
      b.innerHTML = "&#128172;";
      b.title = texto;
      b.style.cssText = "width:" + d2 + "px;height:" + d2 + "px;border-radius:50%;border:none;cursor:pointer;color:#fff;font-size:" + Math.round(fonte * 1.5) + "px;box-shadow:0 3px 10px rgba(0,0,0,.25);background:" + cor + ";";
    } else {
      b.style.cssText = "display:inline-flex;align-items:center;border:none;border-radius:" + raio + ";cursor:pointer;font-weight:700;color:#fff;box-shadow:0 2px 8px rgba(0,0,0,.2);padding:" + pv + "px " + ph + "px;font-size:" + fonte + "px;background:" + cor + ";font-family:system-ui,sans-serif;";
      var rot = document.createElement("span");
      rot.textContent = texto;
      b.appendChild(rot);
      b.appendChild(dots());
    }
    b.onclick = abrir;
    var elb = comBadge(b);
    if (s && s.parentNode) s.parentNode.insertBefore(elb, s);
    else document.body.appendChild(elb);
    return;
  }

  // BALAO flutuante (padrao)
  var btn = document.createElement("button");
  btn.innerHTML = "&#128172;";
  btn.setAttribute("aria-label", "Abrir chat com a loja");
  btn.style.cssText = "position:fixed;bottom:20px;right:20px;width:56px;height:56px;border-radius:50%;border:none;cursor:pointer;font-size:26px;color:#fff;box-shadow:0 4px 14px rgba(0,0,0,.25);z-index:99998;background:" + cor + ";";
  if (alerta) {
    var bd = document.createElement("span");
    bd.className = "wt-badge";
    bd.textContent = "1";
    btn.style.overflow = "visible";
    btn.style.position = "fixed";
    btn.appendChild(bd);
  }
  btn.onclick = function () {
    abrir();
    btn.innerHTML = (box.style.display === "none" ? "&#128172;" : "&#10005;") + (alerta && box.style.display === "none" ? '<span class="wt-badge">1</span>' : "");
  };
  document.body.appendChild(btn);
})();
