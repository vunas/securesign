import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { getInternalApiUrl } from "@/lib/server/api-url";
import type { DashboardData } from "./types";

/**
 * React.cache() đảm bảo nếu cả layout.tsx và page.tsx cùng gọi hàm này
 * trong một chu kỳ render, Next.js chỉ gửi đúng 1 HTTP request tới backend.
 */
export const getDashboardSummary = cache(
  async (): Promise<DashboardData | null> => {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get("access_token")?.value;
    if (!accessToken) return null;

    const response = await fetch(
      `${getInternalApiUrl()}/dashboard-api/summary`,
      {
        headers: { cookie: `access_token=${accessToken}` },
        cache: "no-store",
      },
    );

    if (response.status === 401) return null;
    if (!response.ok) {
      throw new Error(`Không thể tải Dashboard (HTTP ${response.status}).`);
    }

    return (await response.json()) as DashboardData;
  },
);