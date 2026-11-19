import DashboardClient, { type DashboardData } from "./DashboardClient";
import { fetchServerApi, requireServerUser } from "@/lib/server/auth";

export default async function DashboardPage() {
  const user = await requireServerUser("/dashboard");
  const data = await fetchServerApi<DashboardData>(
    "/dashboard-api/summary",
    "/dashboard",
  );

  return <DashboardClient initialData={data} username={user.username} />;
}
