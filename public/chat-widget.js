/* Widget de chat por marca — 3 modos:
 * 1) BALAO flutuante (padrao):  <script src=".../chat-widget.js" data-marca="SLUG"></script>
 * 2) BOTAO inline:              + data-texto="Fale com a sua loja"
 * 3) CAMPO de digitacao:        + data-texto="Digite sua mensagem…" data-estilo="campo"
 * Opcoes: data-cor="#e11d48" · data-tamanho = p | m | g | numero (px da fonte, ex. 22)
 * Os 3 pontinhos "digitando" (estilo WhatsApp) animam no botao e no campo. */
(function () {
  var s = document.currentScript;
  var marca = (s && s.getAttribute("data-marca")) || "";
  var base = (s && s.getAttribute("data-base")) || "https://contactcenter.com.br";
  var cor = (s && s.getAttribute("data-cor")) || "#0f172a";
  var texto = (s && s.getAttribute("data-texto")) || "";
  var estilo = (s && s.getAttribute("data-estilo")) || "";
  var tam = (s && s.getAttribute("data-tamanho")) || "m";
  if (!marca) return;

  // fonte em px: presets p/m/g ou numero livre (slider do gerador)
  var fonte = tam === "p" ? 13 : tam === "g" ? 18 : tam === "m" ? 15 : parseInt(tam, 10);
  if (!fonte || fonte < 11 || fonte > 40) fonte = 15;
  var pv = Math.round(fonte * 0.62), ph = Math.round(fonte * 1.5);

  // keyframes dos pontinhos (1 unica vez por pagina)
  if (!document.getElementById("wt-chat-css")) {
    var css = document.createElement("style");
    css.id = "wt-chat-css";
    css.textContent = "@keyframes wtdot{0%,60%,100%{opacity:.25;transform:translateY(0)}30%{opacity:1;transform:translateY(-3px)}}" +
      ".wt-dots{display:inline-flex;gap:3px;margin-left:8px;align-items:center}" +
      ".wt-dots i{width:6px;height:6px;border-radius:50%;background:currentColor;display:inline-block;animation:wtdot 1.3s infinite}" +
      ".wt-dots i:nth-child(2){animation-delay:.18s}.wt-dots i:nth-child(3){animation-delay:.36s}";
    document.head.appendChild(css);
  }
  function dots() {
    var d = document.createElement("span");
    d.className = "wt-dots";
    d.innerHTML = "<i></i><i></i><i></i>";
    return d;
  }

  var box = document.getElementById("wt-chat-box");
  if (!box) {
    box = document.createElement("div");
    box.id = "wt-chat-box";
    box.style.cssText = "position:fixed;bottom:88px;right:20px;width:370px;max-width:calc(100vw - 32px);height:560px;max-height:calc(100vh - 120px);border-radius:14px;overflow:hidden;box-shadow:0 8px 30px rgba(0,0,0,.3);z-index:99999;display:none;background:#fff;";
    var frame = document.createElement("iframe");
    frame.src = base + "/embed/chat/" + encodeURIComponent(marca);
    frame.style.cssText = "width:100%;height:100%;border:0;";
    frame.setAttribute("title", "Chat com a loja");
    box.appendChild(frame);
    document.body.appendChild(box);
  }
  function abrir() { box.style.display = box.style.display === "none" ? "block" : "none"; }

  if (texto && estilo === "campo") {
    // CAMPO "para digitar": parece a caixa de mensagem; clicar abre o chat.
    var campo = document.createElement("div");
    campo.setAttribute("role", "button");
    campo.setAttribute("tabindex", "0");
    campo.style.cssText = "display:inline-flex;align-items:center;justify-content:space-between;gap:10px;min-width:" + (fonte * 15) + "px;max-width:100%;border:2px solid " + cor + ";border-radius:999px;background:#fff;cursor:text;padding:" + pv + "px " + ph + "px;font-size:" + fonte + "px;color:#64748b;font-family:system-ui,sans-serif;";
    var rot = document.createElement("span");
    rot.textContent = texto;
    var lado = document.createElement("span");
    lado.style.cssText = "display:inline-flex;align-items:center;color:" + cor + ";font-weight:700;";
    lado.appendChild(dots());
    campo.appendChild(rot);
    campo.appendChild(lado);
    campo.onclick = abrir;
    campo.onkeydown = function (e) { if (e.key === "Enter" || e.key === " ") abrir(); };
    if (s && s.parentNode) s.parentNode.insertBefore(campo, s);
    else document.body.appendChild(campo);
    return;
  }

  if (texto) {
    // BOTAO inline com pontinhos animados
    var b = document.createElement("button");
    b.type = "button";
    b.style.cssText = "display:inline-flex;align-items:center;border:none;border-radius:999px;cursor:pointer;font-weight:700;color:#fff;box-shadow:0 2px 8px rgba(0,0,0,.2);padding:" + pv + "px " + ph + "px;font-size:" + fonte + "px;background:" + cor + ";font-family:system-ui,sans-serif;";
    var rotb = document.createElement("span");
    rotb.textContent = texto;
    b.appendChild(rotb);
    b.appendChild(dots());
    b.onclick = abrir;
    if (s && s.parentNode) s.parentNode.insertBefore(b, s);
    else document.body.appendChild(b);
    return;
  }

  // BALAO flutuante (padrao)
  var btn = document.createElement("button");
  btn.innerHTML = "&#128172;";
  btn.setAttribute("aria-label", "Abrir chat com a loja");
  btn.style.cssText = "position:fixed;bottom:20px;right:20px;width:56px;height:56px;border-radius:50%;border:none;cursor:pointer;font-size:26px;color:#fff;box-shadow:0 4px 14px rgba(0,0,0,.25);z-index:99998;background:" + cor + ";";
  btn.onclick = function () {
    abrir();
    btn.innerHTML = box.style.display === "none" ? "&#128172;" : "&#10005;";
  };
  document.body.appendChild(btn);
})();
