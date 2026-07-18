import type { NextConfig } from 'next'

// Security headers applied to every response.
//
// CSP HONESTY: script-src still allows 'unsafe-inline' because the Next.js App Router
// injects inline bootstrap/hydration scripts and this config sets a STATIC header (no
// per-request nonce). So treat this CSP as defense-in-depth, NOT a full XSS mitigation
// — an injected inline <script> would still run. The recommended upgrade is a
// nonce-based CSP set in src/proxy.ts (generate a per-request nonce, drop
// 'unsafe-inline', add 'strict-dynamic'). 'unsafe-eval' has been removed (app code
// never needs it). connect-src allows Supabase (REST + realtime) and local dev.
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co http://127.0.0.1:* ws://127.0.0.1:*",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  },
]

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },
}

export default nextConfig
