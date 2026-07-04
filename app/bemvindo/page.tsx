// Pagina institucional MINIMA da raiz p/ visitantes deslogados (clientes finais
// que digitarem o dominio). Mostra SO o nome do dominio — nenhum conteudo,
// nenhum link do sistema (pedido do Renato, 03/07).
export default function BemVindoPage() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#fff" }}>
      <span style={{ fontFamily: "system-ui, sans-serif", fontSize: 22, color: "#0f172a", letterSpacing: 0.3 }}>
        contactcenter.com.br
      </span>
    </div>
  );
}
