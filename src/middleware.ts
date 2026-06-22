import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PUBLIC_ROUTES = ['/login', '/signup', '/auth/callback']

/**
 * Pure function for testability (PROJ-15). Nonce replaces 'unsafe-inline' in script-src.
 */
export function buildCsp(nonce: string): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' blob:`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self'",
    "worker-src blob: 'self'",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co wss://api.elevenlabs.io https://api.elevenlabs.io",
    "frame-ancestors 'none'",
  ].join('; ')
}

export async function middleware(request: NextRequest) {
  const nonce = crypto.randomUUID()
  const csp = buildCsp(nonce)

  // Forward x-nonce on the *request* headers so Server Components (root layout)
  // can read it via headers() during render — not just on the response.
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)

  let supabaseResponse = NextResponse.next({ request: { headers: requestHeaders } })

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
          supabaseResponse = NextResponse.next({ request: { headers: requestHeaders } })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl
  const isPublicRoute = PUBLIC_ROUTES.some(route => pathname.startsWith(route))

  let response: NextResponse
  if (!user && !isPublicRoute) {
    response = NextResponse.redirect(new URL('/login', request.url))
  } else if (user && (pathname === '/' || pathname === '/login' || pathname === '/signup')) {
    response = NextResponse.redirect(new URL('/dashboard', request.url))
  } else {
    response = supabaseResponse
  }

  response.headers.set('Content-Security-Policy', csp)
  response.headers.set('x-nonce', nonce)
  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
