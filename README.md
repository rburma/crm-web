# CRM World Tennis — telas (frontend)

Frontend do CRM (Next.js 14 + TypeScript + Tailwind). Consome a API do **motor**
(Render) através de um **proxy servidor→servidor** — os segredos (portão do motor
+ identidade) ficam só na Vercel, nunca no navegador.

## Telas desta 1ª leva
- **Clientes** — busca (nome, CPF, telefone, e-mail) → lista.
- **Ficha 360** — dados do cliente + atendimentos + clubes.
- **Atendimento** — conversa completa (estilo chat) com o histórico real.
- **Atendimentos** — lista com busca + filtro de status.

## Segurança (piloto)
- O site inteiro fica atrás de um **portão Basic Auth** (`APP_USER`/`APP_PASS`) —
  o navegador pede login ao abrir.
- O proxy adiciona, no servidor, o portão do motor (`RENDER_GATE_*`) e a
  identidade (`RENDER_USER_ID`). Nada de segredo vai pro navegador.
- Próxima evolução: login por pessoa (cada atendente a sua conta).

## Variáveis de ambiente (definir na Vercel)
Veja `.env.example`. São 6:
`APP_USER`, `APP_PASS`, `RENDER_API_URL`, `RENDER_GATE_USER`, `RENDER_GATE_PASS`,
`RENDER_USER_ID`.

## Deploy (Vercel)
1. Suba este repositório ao GitHub.
2. Na Vercel: **New Project** → importe o repositório → framework **Next.js**.
3. Em **Environment Variables**, cole as 6 acima.
4. **Deploy**. (A Vercel roda o build e aponta os erros, se houver.)

## Rodar local (se tiver Node)
```
npm install
npm run dev
```
