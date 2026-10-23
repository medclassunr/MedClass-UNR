const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""
const supabaseWs = supabaseUrl.replace(/^https/, "wss")
const supabaseHostname = supabaseUrl ? new URL(supabaseUrl).hostname : ""

const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://va.vercel-scripts.com https://sdk.mercadopago.com http://sdk.mercadopago.com https://http2.mlstatic.com",
  "style-src 'self' 'unsafe-inline' https://sdk.mercadopago.com https://fonts.googleapis.com",
  `img-src 'self' data: blob: ${supabaseUrl} https://*.ytimg.com https://http2.mlstatic.com https://www.mercadopago.com https://www.mercadopago.com.ar`,
  `media-src 'self' ${supabaseUrl}`,
  "font-src 'self' data: https://http2.mlstatic.com https://fonts.gstatic.com",
  `connect-src 'self' ${supabaseUrl} ${supabaseWs} https://va.vercel-scripts.com https://vitals.vercel-insights.com https://api.mercadopago.com https://events.mercadopago.com https://http2.mlstatic.com https://www.mercadopago.com https://www.mercadopago.com.ar`,
  // 'self' é necessário pra embutir os simuladores de Hospital Simulação
  // (iframe same-origin pra /simuladores/*.html) -- sem isso o navegador
  // bloqueia a página de embutir seu próprio iframe.
  "frame-src 'self' https://www.youtube-nocookie.com https://www.mercadopago.com https://www.mercadopago.com.ar https://bins.mercadopago.com",
  "object-src 'none'",
].join("; ")

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
]

// Os arquivos de /simuladores/ (Hospital Simulação) são carregados dentro de
// um <iframe> same-origin -- X-Frame-Options: DENY bloqueia isso mesmo sendo
// o próprio domínio, então essa pasta recebe SAMEORIGIN + frame-ancestors
// 'self' em vez do DENY global. Resto da CSP continua igual (o simulador
// tem <script>/<style> inline próprios, cobertos pelo 'unsafe-inline' já
// existente em script-src/style-src).
const simuladoresCsp = `${csp}; frame-ancestors 'self'`
const simuladoresHeaders = [
  { key: "Content-Security-Policy", value: simuladoresCsp },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
]

// Versão do build, exposta ao client (process.env.NEXT_PUBLIC_APP_VERSION).
// Na Vercel usa o hash do commit (muda a cada deploy); localmente cai no
// timestamp do build. É o que o app compara contra /api/version pra saber
// que saiu uma atualização nova -- ver hooks/use-app-update.
const appVersion =
  process.env.VERCEL_GIT_COMMIT_SHA ||
  process.env.NEXT_PUBLIC_APP_VERSION ||
  String(Date.now())

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_APP_VERSION: appVersion,
  },
  images: {
    remotePatterns: supabaseHostname
      ? [{ protocol: "https", hostname: supabaseHostname, pathname: "/storage/v1/object/public/**" }]
      : [],
  },
  async headers() {
    // So aplica em producao: Turbopack/HMR do dev server pode depender de eval
    // e outros padroes que uma CSP estrita bloquearia, quebrando o `npm run dev`.
    if (process.env.NODE_ENV !== "production") return []
    return [
      { source: "/((?!simuladores/).*)", headers: securityHeaders },
      { source: "/simuladores/:path*", headers: simuladoresHeaders },
    ]
  },
}

export default nextConfig
