import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CRM World Tennis",
  description: "CRM — atendimento, clientes 360 e relacionamento.",
  // Padrão: NÃO indexar (protege o admin/painel atrás do portão). As páginas
  // públicas de atendimento ao consumidor sobrescrevem com index:true.
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
