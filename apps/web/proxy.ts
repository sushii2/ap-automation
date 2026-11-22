import { NextResponse, type NextRequest } from "next/server"
import {
  applyResponseHeaders,
  authkit,
  handleAuthkitHeaders,
  partitionAuthkitHeaders,
} from "@workos-inc/authkit-nextjs"

import { buildCsp } from "@/lib/security-headers"

// Everything else requires a session (secure by default).
const PUBLIC_PATHS = new Set(["/", "/sign-in", "/sign-up", "/callback"])

export async function proxy(request: NextRequest) {
  const isDev = process.env.NODE_ENV === "development"

  // Behind a TLS-terminating load balancer, reject anything that arrived over plain HTTP.
  if (!isDev && request.headers.get("x-forwarded-proto") === "http") {
    const url = request.nextUrl.clone()
    url.protocol = "https:"
    return NextResponse.redirect(url, 308)
  }

  // Validates/refreshes the WorkOS session and prepares the headers `withAuth()` reads.
  const { session, headers, authorizationUrl } = await authkit(request)

  if (
    !PUBLIC_PATHS.has(request.nextUrl.pathname) &&
    !session.user &&
    authorizationUrl
  ) {
    // Hosted AuthKit sign-in; returns to the requested path afterwards.
    return handleAuthkitHeaders(request, headers, { redirect: authorizationUrl })
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64")
  const csp = buildCsp(nonce, isDev)

  // Session headers go to the app only; cookies etc. go to the browser.
  const { requestHeaders, responseHeaders } = partitionAuthkitHeaders(
    request,
    headers
  )
  requestHeaders.set("x-nonce", nonce)
  requestHeaders.set("Content-Security-Policy", csp)

  const response = NextResponse.next({ request: { headers: requestHeaders } })
  applyResponseHeaders(response, responseHeaders)
  response.headers.set("Content-Security-Policy", csp)
  return response
}

export const config = {
  // Prefetches are matched too: `withAuth()` throws on any request the proxy skipped.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
}
