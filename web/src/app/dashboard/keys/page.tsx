import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getDashboardSummary } from "../_lib/dashboard-data";
import KeysSection from "../_components/KeysSection";
import { KeysPageSkeleton } from "../_components/DashboardSkeletons";

async function KeysContent() {
  const data = await getDashboardSummary();
  if (!data) redirect("/login");

  return (
    <KeysSection
      keys={data.keys}
      canManageApiKeys={data.permissions.can_manage_api_keys}
      canRevokeKeys={data.permissions.can_revoke_keys}
    />
  );
}

export default function DashboardKeysPage() {
  return (
    <Suspense fallback={<KeysPageSkeleton />}>
      <KeysContent />
    </Suspense>
  );
}