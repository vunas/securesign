import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getDashboardSummary } from "../_lib/dashboard-data";
import AuditSection from "../_components/AuditSection";
import { AuditPageSkeleton } from "../_components/DashboardSkeletons";

async function AuditContent() {
  const data = await getDashboardSummary();
  if (!data) redirect("/login");

  return <AuditSection mode="full" signatures={data.signatures} />;
}

export default function DashboardAuditPage() {
  return (
    <Suspense fallback={<AuditPageSkeleton />}>
      <AuditContent />
    </Suspense>
  );
}