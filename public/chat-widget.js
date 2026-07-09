/* Widget de chat por marca — 2 modos:
 * 1) BALAO flutuante (padrao):
 *    <script src="https://contactcenter.com.br/chat-widget.js" data-marca="SLUG"></script>
 * 2) BOTAO inline personalizavel (aparece ONDE o script for colado):
 *    <script src=".../chat-widget.js" data-marca="SLUG" data-texto="Fale com a sua loja"
 *            data-cor="#e11d48" data-tamanho="g"></script>
 *    data-texto = call to action · data-cor = cor · data-tamanho = p | m | g */
(function () {
  var s = document.currentScript;
  var marca = (s && s.getAttribute("data-marca")) || "";
  var base = (s && s.getAttribute("data-base")) || "https://contactcenter.com.br";
  var cor = (s && s.getAttribute("data-cor")) || "#0f172a";
  var texto = (s && s.getAttribute("data-texto")) || "";
  var tamanho = ((s && s.getAttribute("data-tamanho")) || "m").toLowerCase();
  if (!marca) return;

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
  function alternar() {
    box.style.display = box.style.display === "none" ? "block" : "none";
  }

  if (texto) {
    // MODO BOTAO: entra no lugar exato onde o snippet foi colado.
    var tam = tamanho === "p" ? "8px 16px;font-size:13px" :
              tamanho === "g" ? "16px 32px;font-size:18px" : "12px 24px;font-size:15px";
    var b = document.createElement("button");
    b.type = "button";
    b.textContent = texto;
    b.style.cssText = "border:none;border-radius:999px;cursor:pointer;font-weight:700;color:#fff;box-shadow:0 2px 8px rgba(0,0,0,.2);padding:" + tam + ";background:" + cor + ";";
    b.onclick = alternar;
    if (s && s.parentNode) s.parentNode.insertBefore(b, s);
    else document.body.appendChild(b);
    return;
  }

  // MODO BALAO flutuante (padrao)
  var btn = document.createElement("button");
  btn.innerHTML = "&#128172;";
  btn.setAttribute("aria-label", "Abrir chat com a loja");
  btn.style.cssText = "position:fixed;bottom:20px;right:20px;width:56px;height:56px;border-radius:50%;border:none;cursor:pointer;font-size:26px;color:#fff;box-shadow:0 4px 14px rgba(0,0,0,.25);z-index:99998;background:" + cor + ";";
  btn.onclick = function () {
    alternar();
    btn.innerHTML = box.style.display === "none" ? "&#128172;" : "&#10005;";
  };
  document.body.appendChild(btn);
})();
