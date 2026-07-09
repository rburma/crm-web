/* Widget de chat por marca — cole no site ou num bloco HTML do WordPress:
   <script src="https://contactcenter.com.br/chat-widget.js" data-marca="SLUG"></script> */
(function () {
  var s = document.currentScript;
  var marca = (s && s.getAttribute("data-marca")) || "";
  var base = (s && s.getAttribute("data-base")) || "https://contactcenter.com.br";
  var cor = (s && s.getAttribute("data-cor")) || "#0f172a";
  if (!marca) return;
  var btn = document.createElement("button");
  btn.innerHTML = "&#128172;";
  btn.setAttribute("aria-label", "Abrir chat com a loja");
  btn.style.cssText = "position:fixed;bottom:20px;right:20px;width:56px;height:56px;border-radius:50%;border:none;cursor:pointer;font-size:26px;color:#fff;box-shadow:0 4px 14px rgba(0,0,0,.25);z-index:99998;background:" + cor + ";";
  var box = document.createElement("div");
  box.style.cssText = "position:fixed;bottom:88px;right:20px;width:370px;max-width:calc(100vw - 32px);height:560px;max-height:calc(100vh - 120px);border-radius:14px;overflow:hidden;box-shadow:0 8px 30px rgba(0,0,0,.3);z-index:99999;display:none;background:#fff;";
  var frame = document.createElement("iframe");
  frame.src = base + "/embed/chat/" + encodeURIComponent(marca);
  frame.style.cssText = "width:100%;height:100%;border:0;";
  frame.setAttribute("title", "Chat com a loja");
  box.appendChild(frame);
  btn.onclick = function () {
    var aberto = box.style.display !== "none";
    box.style.display = aberto ? "none" : "block";
    btn.innerHTML = aberto ? "&#128172;" : "&#10005;";
  };
  document.body.appendChild(btn);
  document.body.appendChild(box);
})();
