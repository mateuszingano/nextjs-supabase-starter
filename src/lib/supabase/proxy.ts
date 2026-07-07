import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Routes reachable without a session.
const PUBLIC_ROUTES = ['/login', '/signup', '/reset-password', '/auth/callback', '/auth/logout']

// Refreshes the Supabase session on every request and guards protected routes.
// The login check here is an edge-layer convenience; the authoritative check
// still lives in Server Components / route handlers (defense in depth).
export async function updateSession(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (
    PUBLIC_ROUTES.some((r) => pathname.startsWith(r)) ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    // Any dotted path is treated as a static/public file (robots.txt, sitemap.xml,
    // fonts…) and skipped. Protected routes have no dot; if you add a dotted route,
    // exclude it via the matcher in src/proxy.ts instead of relying on this.
    pathname.includes('.')
  ) {
    return NextResponse.next({ request })
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: getUser() revalidates the token with Supabase (works in every
  // browser, including Safari/iOS). Do not swap for getSession() here.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return supabaseResponse
}
