import { Suspense } from "react";
import { getServerSession } from "@/lib/server/session";
import LandingHeaderClient from "./LandingHeaderClient";

async function LandingHeaderContent() {
  const { profile, hasSession } = await getServerSession();
  const username = profile?.username ?? (hasSession ? "Tài khoản" : null);
  const workspaceHref =
    profile?.role === "PLATFORM_SUPER_ADMIN" ? "/admin/tenants" : "/dashboard";

  return (
    <LandingHeaderClient username={username} workspaceHref={workspaceHref} />
  );
}

function LandingHeaderFallback() {
  return (
    <header
      aria-label="Đang tải thanh điều hướng"
      aria-busy="true"
      className="fixed top-0 z-50 h-14 w-full border-b border-slate-200/90 bg-white/95"
    />
  );
}

export default function LandingHeader() {
  return (
    <Suspense fallback={<LandingHeaderFallback />}>
      <LandingHeaderContent />
    </Suspense>
  );
}
