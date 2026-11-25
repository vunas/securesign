import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { getInternalApiUrl } from "@/lib/server/api-url";
import type { UserProfile } from "@/lib/api";

export const getServerSession = cache(async () => {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("access_token")?.value;
  const hasSession = Boolean(
    accessToken || cookieStore.get("refresh_token")?.value,
  );

  if (!accessToken) return { profile: null, hasSession };

  const response = await fetch(`${getInternalApiUrl()}/auth/me`, {
    headers: { cookie: `access_token=${accessToken}` },
    cache: "no-store",
  });

  if (response.status === 401) return { profile: null, hasSession };
  if (!response.ok) {
    throw new Error(`Không thể tải thông tin phiên (HTTP ${response.status}).`);
  }

  return {
    profile: (await response.json()) as UserProfile,
    hasSession,
  };
});
