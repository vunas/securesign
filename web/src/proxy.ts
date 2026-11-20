import { NextRequest, NextResponse } from "next/server";

const protectedRoutes = [
  "/dashboard",
  "/sign",
  "/log",
  "/generate-key",
  "/api-keys",
  "/team",
  "/admin/tenants",
];

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const isProtectedRoute = protectedRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
  if (!isProtectedRoute) return NextResponse.next();

  const hasSessionCookie = ["access_token", "refresh_token"].some(
    (name) => Boolean(request.cookies.get(name)?.value),
  );
  if (hasSessionCookie) return NextResponse.next();

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/sign/:path*",
    "/log/:path*",
    "/generate-key/:path*",
    "/api-keys/:path*",
    "/team/:path*",
    "/admin/tenants/:path*",
  ],
};
