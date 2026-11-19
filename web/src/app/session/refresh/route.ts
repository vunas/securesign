import { NextRequest, NextResponse } from "next/server";
import { getInternalApiUrl } from "@/lib/server/auth";

function getSafeReturnPath(request: NextRequest): string {
  const returnPath = request.nextUrl.searchParams.get("next");
  if (!returnPath || !returnPath.startsWith("/") || returnPath.startsWith("//")) {
    return "/dashboard";
  }

  const destination = new URL(returnPath, request.url);
  return destination.origin === request.nextUrl.origin
    ? `${destination.pathname}${destination.search}${destination.hash}`
    : "/dashboard";
}

function redirectToLogin(request: NextRequest): NextResponse {
  const response = NextResponse.redirect(new URL("/login?session=expired", request.url));
  response.cookies.delete("access_token");
  response.cookies.delete("refresh_token");
  return response;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const refreshToken = request.cookies.get("refresh_token")?.value;
  if (!refreshToken) return redirectToLogin(request);

  const upstream = await fetch(`${getInternalApiUrl()}/auth/refresh`, {
    method: "POST",
    headers: { cookie: `refresh_token=${refreshToken}` },
    cache: "no-store",
  });
  const refreshedAccessCookie = upstream.headers.get("set-cookie");
  if (!upstream.ok || !refreshedAccessCookie) return redirectToLogin(request);

  const response = NextResponse.redirect(
    new URL(getSafeReturnPath(request), request.url),
  );
  response.headers.append("set-cookie", refreshedAccessCookie);
  return response;
}
