import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CRM World Tennis",
  description: "CRM — atendimento, clientes 360 e relacionamento.",
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
