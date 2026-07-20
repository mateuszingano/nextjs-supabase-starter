import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Routes reachable without a session.
const PUBLIC_ROUTES = ['/login', '/signup', '/reset-password', '/auth/callback', '/auth/logout']

// Static assets served from /public that carry no session and can skip the auth
// check. We match a KNOWN extension at the end of the path — never "a dot anywhere".
// The old pathname.includes('.') skipped auth for ANY path containing a dot, so a
// crafted protected path with a dot in it could slip past this edge check.
const STATIC_ASSET = /\.(?:ico|png|jpe?g|gif|svg|webp|avif|css|js|mjs|map|txt|xml|woff2?|ttf|otf|eot|webmanifest)$/i

// True when a request needs no session: an exact public route (or a subpath of one),
// a Next.js internal, or a static asset. Public routes match on a path boundary — a
// prefix like /login-evil is NOT public. Exported so it can be unit-tested directly.
export function isPublicPath(pathname: string): boolean {
  const isPublicRoute = PUBLIC_ROUTES.some((r) => pathname === r || pathname.startsWith(r + '/'))
  // `/_next` matches on a path BOUNDARY, same as the public routes above. A bare
  // `startsWith('/_next')` would also treat `/_nextevil/x` as public — the exact
  // prefix-lookalike bug this function was hardened against for `/login`, left
  // half-fixed on the line below it.
  const isNextAsset = pathname === '/_next' || pathname.startsWith('/_next/')
  return isPublicRoute || isNextAsset || STATIC_ASSET.test(pathname)
}

// Refreshes the Supabase session on every request and guards protected routes.
// The login check here is an edge-layer convenience; the authoritative check
// still lives in Server Components / route handlers (defense in depth).
export async function updateSession(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (isPublicPath(pathname)) {
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

  if (!user) return unauthenticatedResponse(pathname, request.url)

  return supabaseResponse
}

/**
 * How an unauthenticated request is turned away, by kind of caller.
 *
 * A page navigation should land on /login. A `fetch()` from the app, a mobile
 * client or a CLI should get a machine-readable 401 instead: redirecting an API
 * call to an HTML login page means the caller runs `res.json()` on markup and
 * dies with a parse error, rather than triggering its re-auth flow. Exported so
 * the rule is unit-testable without standing up the whole Supabase client.
 */
export function unauthenticatedResponse(pathname: string, requestUrl: string): NextResponse {
  if (pathname === '/api' || pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return NextResponse.redirect(new URL('/login', requestUrl))
}
