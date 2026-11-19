import "server-only";

import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import type { SessionUser } from "@/lib/types/auth";

export function getInternalApiUrl(): string {
  return (
    process.env.INTERNAL_API_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    "http://localhost:8000"
  ).replace(/\/+$/, "");
}

async function getAccessCookieHeader(): Promise<string | null> {
  const cookieHeader = (await headers()).get("cookie");
  if (!cookieHeader) return null;

  return (
    cookieHeader
      .split(";")
      .map((cookie) => cookie.trim())
      .find((cookie) => cookie.startsWith("access_token=")) ?? null
  );
}

async function redirectForSession(nextPath: string): Promise<never> {
  const refreshToken = (await cookies()).get("refresh_token")?.value;
  if (refreshToken) {
    redirect(`/session/refresh?next=${encodeURIComponent(nextPath)}`);
  }
  redirect("/login");
}

export const getServerUser = cache(async (): Promise<SessionUser | null> => {
  const cookie = await getAccessCookieHeader();
  if (!cookie) return null;

  const response = await fetch(`${getInternalApiUrl()}/auth/me`, {
    headers: { cookie },
    cache: "no-store",
  });
  if (response.status === 401) return null;
  if (!response.ok) {
    throw new Error(`Không thể xác thực phiên đăng nhập (${response.status}).`);
  }

  return (await response.json()) as SessionUser;
});

export async function requireServerUser(nextPath: string): Promise<SessionUser> {
  const user = await getServerUser();
  if (user) return user;

  return redirectForSession(nextPath);
}

export async function fetchServerApi<T>(
  endpoint: string,
  nextPath: string,
): Promise<T> {
  const cookie = await getAccessCookieHeader();
  if (!cookie) return redirectForSession(nextPath);

  const response = await fetch(`${getInternalApiUrl()}${endpoint}`, {
    headers: { cookie },
    cache: "no-store",
  });

  if (response.status === 401) return redirectForSession(nextPath);
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      detail?: string;
      message?: string;
    } | null;
    throw new Error(
      body?.detail ?? body?.message ?? `Yêu cầu API thất bại (${response.status}).`,
    );
  }

  return (await response.json()) as T;
}
