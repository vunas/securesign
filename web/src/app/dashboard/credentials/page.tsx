import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getDashboardSummary } from "../_lib/dashboard-data";
import CredentialsSection from "../_components/CredentialsSection";
import { CredentialsPageSkeleton } from "../_components/DashboardSkeletons";

async function CredentialsContent() {
  const data = await getDashboardSummary();
  if (!data) redirect("/login");

  return (
    <CredentialsSection
      mode="full"
      credentials={data.credentials}
      canRevokeCredentials={data.permissions.can_revoke_credentials}
    />
  );
}

export default function DashboardCredentialsPage() {
  return (
    <Suspense fallback={<CredentialsPageSkeleton />}>
      <CredentialsContent />
    </Suspense>
  );
}