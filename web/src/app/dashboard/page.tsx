import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getDashboardSummary } from "./_lib/dashboard-data";
import OverviewCharts from "./_components/OverviewCharts";
import CredentialsSection from "./_components/CredentialsSection";
import KeysSection from "./_components/KeysSection";
import AuditSection from "./_components/AuditSection";
import { OverviewPageSkeleton } from "./_components/DashboardSkeletons";

async function OverviewContent() {
  const data = await getDashboardSummary();
  if (!data) redirect("/login");

  return (
    <>
      <OverviewCharts
        totalSigs={data.stats.total_sigs}
        signatures={data.signatures}
        credentials={data.credentials}
      />
      <CredentialsSection
        mode="preview"
        credentials={data.credentials}
        canRevokeCredentials={data.permissions.can_revoke_credentials}
      />
      <KeysSection
        keys={data.keys}
        canManageApiKeys={data.permissions.can_manage_api_keys}
        canRevokeKeys={data.permissions.can_revoke_keys}
      />
      <AuditSection mode="preview" signatures={data.signatures} />
    </>
  );
}

export default function DashboardOverviewPage() {
  return (
    <Suspense fallback={<OverviewPageSkeleton />}>
      <OverviewContent />
    </Suspense>
  );
}