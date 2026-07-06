/** @type {import('next').NextConfig} */
// Expoe o SHA do commit como NEXT_PUBLIC_VERSION (rodape do /login) — permite
// conferir DE FORA qual build esta no ar (mesmo padrao do cobranca-wt).
const gitSha =
  process.env.VERCEL_GIT_COMMIT_SHA || process.env.GIT_SHA || "dev";

const nextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_VERSION: gitSha.slice(0, 7),
  },
};

export default nextConfig;
