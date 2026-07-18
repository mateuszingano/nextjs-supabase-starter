import type { NextConfig } from 'next'

// Security headers applied to every response.
//
// CSP: script-src allows 'unsafe-inline' as a DELIBERATE, verified trade-off. A
// nonce-based CSP (per-request nonce + 'strict-dynamic', no 'unsafe-inline') was
// implemented and tested against a production build: it does NOT work with this app's
// STATICALLY prerendered pages (/, /login, /signup, …). Next stamps the per-request
// nonce onto its scripts only when a page is DYNAMICALLY rendered; a static page's HTML
// is baked at build time, so its scripts carry no nonce and 'strict-dynamic' then blocks
// every script — a blank page. Making it work would require forcing dynamic rendering on
// all pages, sacrificing static optimization. So this stays a defense-in-depth CSP (an
// injected inline <script> would still run); pair it with output escaping + trusted-types
// at the app level. 'unsafe-eval' is removed (app code never needs it). connect-src
// allows Supabase (REST + realtime) and local dev.
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
